// Name of an attribute used to relate elements across slides.
const dataSsId = 'data-ss-id';
function animateSlideShows() {
  for (const listElement of document.querySelectorAll('ol.slideshow')) {
    animateSlideShow(listElement);
  }
}

function animateSlideShow(listElement) {
  let slides = [...listElement.childNodes]
      .filter((x) => x.nodeType === 1 && x.nodeName === 'LI');
  if (!slides.length) { return; }
  slides[0].classList.add('selected');

  let autorunInterval = null;
  listElement.autorunSlideShow = () => {
    if (autorunInterval === null) {
      autorunInterval = setInterval(
	() => {
	  let top = $(listElement).top;
	  let bottom = top + listElement.offsetHeight;
	  let vpTop = window.pageYOffset;
	  let vpBottom = vpTop + window.innerHeight;
	  if (!(top >= vpBottom || bottom <= vpTop)) {
	    // Scrolled into view
	    transitionBy(1);
	  }
	},
	2000 /* ms */);
    }
  };

  function cancelAutorun() {
    if (autorunInterval !== null) {
      clearInterval(autorunInterval);
      autorunInterval = null;
    }
  }

  // Create some next / prev buttons.
  let revButton = document.createElement('button');
  revButton.onclick = () => {
    cancelAutorun();
    transitionBy(-1);
  };
  revButton.textContent = '\xab'
  revButton.classList.add('rev');
  let fwdButton = document.createElement('button');
  fwdButton.onclick = () => {
    cancelAutorun();
    transitionBy(1);
  };
  fwdButton.textContent = '\xbb'
  fwdButton.classList.add('fwd');

  listElement.insertBefore(revButton, slides[0]);
  listElement.insertBefore(fwdButton, slides[0]);
  listElement.classList.add('active-slideshow');

  let finishTransitionInProgress = () => {};

  function transitionBy(delta) {
    // Abruptly complete any transition in progress.
    finishTransitionInProgress();
    finishTransitionInProgress = () => {};

    const nSlides = slides.length;
    let selectedSlideIndex = slides.findIndex(
      x => x.classList.contains('selected'));

    let newSelectedSlideIndex = selectedSlideIndex + delta;
    while (newSelectedSlideIndex >= nSlides) {
      newSelectedSlideIndex -= nSlides;
    }
    while (newSelectedSlideIndex < 0) {
      newSelectedSlideIndex += nSlides;
    }
    if (!(selectedSlideIndex - newSelectedSlideIndex)) {
      return;
    }

    const newSelectedSlide = slides[newSelectedSlideIndex];
    const oldSelectedSlide = slides[selectedSlideIndex];
    newSelectedSlide.classList.add('selected');
    animateTransition(
      oldSelectedSlide,
      newSelectedSlide,
      // Called when the animation finishes.
      () => {
        oldSelectedSlide.classList.remove('selected');
      });
  }

  // Given two HTML elements, finds subtrees with common
  // data-ss-ids.  Then fades out elements in the src and fades in
  // elements in the dest, but with identified elements under src
  // transitioning to the corresponding location in dest.
  //
  // Then is called when the transition is complete, or if another
  // transition starts to interrupt the current one.
  function animateTransition(src, dest, then) {
    finishTransitionInProgress = then;

    // Identify common ss-ids.
    let srcSsIds = new Set(
      [...src.querySelectorAll(`*[${ dataSsId }]`)]
        .map(x => x.getAttribute(dataSsId)));
    let commonSsIds = new Set(
      [...dest.querySelectorAll(`*[${ dataSsId }]`)]
        .map(x => x.getAttribute(dataSsId))
        .filter(x => srcSsIds.has(x)));

    let pairsToMove = new Map();
    for (const ssId of commonSsIds) {
      pairsToMove.set(ssId, [null, null]);
    }
    for (const [root, idx] of [[src, 0], [dest, 1]]) {
      for (const ided of [...root.querySelectorAll(`*[${ dataSsId }]`)]) {
        const ssId = ided.getAttribute(dataSsId);
        if (commonSsIds.has(ssId)) {
          pairsToMove.get(ssId)[idx] = {
            el: ided,
          };
        }
      }
    }
    pairsToMove = [...pairsToMove.values()];

    for (const infos of pairsToMove) {
      for (const info of infos) {
        info.pos = $(info.el).offset();
        info.pos.width = info.el.offsetWidth;
        info.pos.height = info.el.offsetHeight;
        info.centroid = {
          x: info.pos.left + info.pos.width / 2,
          y: info.pos.top + info.pos.height / 2,
        };
      }
    }

    // Force everything to absolute positioning with fixed sizes so
    // that there's no jitter among elements without a data-ss-id as
    // their content changes shape.
    // This also simplifies things when one moving element contains another.
    let allElements = [
      src,  ...src.querySelectorAll('*'),
      dest, ...dest.querySelectorAll('*'),
    ];
    (() => {
      const elementsAndBoxes = allElements.map(
        (el) => [
          el,
          {
            ...$(el).offset(),
            width: el.offsetWidth,
            height: el.offsetHeight,
          }
        ]
      );
      for (const [ el, { left, top, width, height } ] of elementsAndBoxes) {
        const { style } = el;
        style.width = `${ width }px`;
        style.height = `${ height }px`;
        style.position = 'absolute';
        $(el).offset({ left, top });
      }
    })();

    let intervalId = null;
    finishTransitionInProgress = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      try {
        then();
      } finally {
        // Reset all style overrides
        src.style.opacity = dest.style.opacity = '';
        for (const { style } of allElements) {
          style.position =
            style.top =
            style.left =
            style.width =
            style.height = '';
        }
      }
    };

    let stepsDone = 0;
    const stepTotal = 10;

    function doStep(ratio) {
      const dRatio = 1 - ratio;
      src.style.opacity = dRatio;
      dest.style.opacity = ratio;
      for (const [
        { el: srcEl, pos: srcPos, centroid: srcCentroid },
        { el: destEl, pos: destPos, centroid: destCentroid },
      ] of pairsToMove) {
        const centroidX = srcCentroid.x * dRatio + destCentroid.x * ratio;
        const centroidY = srcCentroid.y * dRatio + destCentroid.y * ratio;
        const w = srcPos.width  * dRatio + destPos.width  * ratio;
        const h = srcPos.height * dRatio + destPos.height * ratio;
        moveTo(srcEl,  centroidX, centroidY, w, h);
        moveTo(destEl, centroidX, centroidY, w, h);
      }
    }
    doStep(0);

    intervalId = setInterval(
      () => {
        const ratio = Math.min(1.0, stepsDone / stepTotal);
        ++stepsDone;
        try {
          doStep(ratio);
        } finally {
          if (stepsDone > stepTotal) {
            finishTransitionInProgress();
            finishTransitionInProgress = () => {};
          }
        }
      },
      100
    );
  }

  function moveTo(el, cx, cy, w, h) {
    const { style } = el;
    style.height = `${ h }px`;
    style.width = `${ w }px`;

    let left = cx - w / 2;
    let top = cy - h / 2;
    $(el).offset({ left, top });
  }
}
