// review.spec.ts — writing/editing/deleting a review (ReviewModal).
//
// Step 4 skeleton (test.fixme = planned). Score is 1-10 (see app/api/reviews and
// the modal). The same modal handles create AND edit, so we test both modes.

import { test } from "@playwright/test";

test.describe("Review modal", () => {
  test.fixme("selecting a score highlights it and shows its label", () => {});
  test.fixme("shows an error when submitting without a score", () => {});
  test.fixme("saving a review updates the card button to show the score", () => {});
  test.fixme("reopening shows the existing review pre-filled (edit mode)", () => {});
  test.fixme("deleting a review removes it", () => {});
});
