import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement <dialog> modal behaviour. A minimal stand-in so components can
// call showModal()/close(); real focus trapping is covered by the Playwright tests.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (!proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!proto.close) {
    proto.close = function close(this: HTMLDialogElement) {
      if (!this.open) return;
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}
