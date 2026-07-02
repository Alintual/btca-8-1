(function () {
  "use strict";

  var SAFARI_PREP_WIPE_TOKEN_KEY = "btca-web:safari-prep-wipe-token";
  var GUARD_PREFIX = "BTCA_DATA_GUARD:";

  function isStandalonePwa() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.navigator && window.navigator.standalone === true) return true;
    } catch (_) {}
    return false;
  }

  function grantSafariPrepWipeToken() {
    if (isStandalonePwa()) return false;
    try {
      sessionStorage.setItem(SAFARI_PREP_WIPE_TOKEN_KEY, "granted");
      return true;
    } catch (_) {
      return false;
    }
  }

  function revokeSafariPrepWipeToken() {
    try {
      sessionStorage.removeItem(SAFARI_PREP_WIPE_TOKEN_KEY);
    } catch (_) {}
  }

  function assertTrainingWipePermitted() {
    if (isStandalonePwa()) {
      throw new Error(GUARD_PREFIX + " training data wipe is forbidden in installed PWA");
    }
    try {
      if (sessionStorage.getItem(SAFARI_PREP_WIPE_TOKEN_KEY) !== "granted") {
        throw new Error(GUARD_PREFIX + " training data wipe requires active Safari offline preparation");
      }
    } catch (error) {
      if (error && String(error.message || "").indexOf(GUARD_PREFIX) === 0) throw error;
      throw new Error(GUARD_PREFIX + " training data wipe token unavailable");
    }
  }

  function trainingWipePermitted() {
    try {
      assertTrainingWipePermitted();
      return true;
    } catch (_) {
      return false;
    }
  }

  window.BTCA_DATA_GUARD = {
    GUARD_PREFIX: GUARD_PREFIX,
    isStandalonePwa: isStandalonePwa,
    grantSafariPrepWipeToken: grantSafariPrepWipeToken,
    revokeSafariPrepWipeToken: revokeSafariPrepWipeToken,
    assertTrainingWipePermitted: assertTrainingWipePermitted,
    trainingWipePermitted: trainingWipePermitted,
  };
})();
