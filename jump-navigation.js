(function (root) {
  function getJumpBubbleTargets(doc) {
    const buttons = Array.from(doc.querySelectorAll('.cgcc-toggle-btn'));
    const seen = new Set();
    const targets = [];

    for (const btn of buttons) {
      const bubble = btn.parentElement;
      if (!bubble || !doc.contains(bubble) || seen.has(bubble)) continue;
      seen.add(bubble);
      targets.push({
        button: btn,
        element: bubble,
        viewportTop: bubble.getBoundingClientRect().top,
      });
    }

    targets.sort((a, b) => a.viewportTop - b.viewportTop);
    return targets;
  }

  function selectPreviousJumpTarget(targets, thresholdPx = 10) {
    let previous = null;

    for (const target of targets) {
      if (target.viewportTop < -thresholdPx) previous = target.element;
    }

    return previous || targets[0]?.element || null;
  }

  function selectNextJumpTarget(targets, thresholdPx = 10) {
    const next = targets.find((target) => target.viewportTop > thresholdPx);
    return next ? next.element : null;
  }

  const api = {
    getJumpBubbleTargets,
    selectPreviousJumpTarget,
    selectNextJumpTarget,
  };

  root.CGCCJumpNavigation = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);