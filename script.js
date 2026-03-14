/**
 * Looking – Week 6 Script
 *
 * Each eye tracks the mouse cursor by calculating the angle
 * between the eye centre and the cursor position, then applying
 * that rotation to the eyeball element (which has its pupil
 * offset from centre so it appears to "look" in that direction).
 */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var lefty  = document.getElementById("lefty");
    var righty = document.getElementById("righty");

    if (!lefty || !righty) { return; }

    function getCenter(el) {
      var rect = el.getBoundingClientRect();
      return {
        x: rect.left + rect.width  / 2,
        y: rect.top  + rect.height / 2
      };
    }

    function trackEyes(mx, my) {
      // Left eye
      var lc     = getCenter(lefty);
      var lAngle = Math.atan2(my - lc.y, mx - lc.x) * (180 / Math.PI);
      lefty.style.transform  = "rotate(" + lAngle + "deg)";

      // Right eye
      var rc     = getCenter(righty);
      var rAngle = Math.atan2(my - rc.y, mx - rc.x) * (180 / Math.PI);
      righty.style.transform = "rotate(" + rAngle + "deg)";
    }

    window.addEventListener("mousemove", function (event) {
      trackEyes(event.clientX, event.clientY);
    });

    // Touch support – use first touch point
    window.addEventListener("touchmove", function (event) {
      if (!event.touches || event.touches.length === 0) { return; }
      var touch = event.touches[0];
      trackEyes(touch.clientX, touch.clientY);
    }, { passive: true });
  });

}());
