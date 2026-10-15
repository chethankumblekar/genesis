import assert from "node:assert/strict";
import { test } from "node:test";
import { filterPhotos } from "./photos";

const ID = "8a9fad8281fae0980181fb8036bd6f0c";
const own = `https://images.nobroker.in/images/${ID}/${ID}_50257_7730`;
const other =
  "https://images.nobroker.in/images/8aa99c3ca09fb14501a0a03b325c5493/8aa99c3ca09fb14501a0a03b325c5493_42638_2501";

/* Every chrome URL below was actually stored as a "listing photo". */
const CHROME = [
  "https://assets.nobroker.in/nb-new/public/payrent.png",
  "https://www.nobroker.in/nb-new/public/NewProjectPage/bus.png",
  "https://assets.nobroker.in/static/img/resale/resale_logo_2.png",
  "https://assets.nobroker.in/nb-new/public/MaterialIcons/Info.png",
];

test("site furniture is never kept as a photo", () => {
  assert.deepEqual(filterPhotos(CHROME, "nobroker", ID), []);
});

test("a listing's own photos come first", () => {
  const got = filterPhotos([other, ...CHROME, own], "nobroker", ID);
  assert.equal(got[0], own, "its own photo leads");
  assert.ok(got.includes(other));
  assert.equal(got.some((u) => u.includes("payrent")), false);
});

test("facebook keeps cdn photos and nothing else", () => {
  const fb = "https://scontent.fblr1-5.fna.fbcdn.net/v/t39.30808-6/abc.jpg";
  const got = filterPhotos([fb, "https://facebook.com/logo.svg", "not a url"], "facebook");
  assert.deepEqual(got, [fb]);
});

test("duplicates and non-strings are dropped", () => {
  const got = filterPhotos([own, own, null, 42, ""], "nobroker", ID);
  assert.deepEqual(got, [own]);
});

test("a capture with no images yields an empty list, not a crash", () => {
  assert.deepEqual(filterPhotos(undefined, "nobroker", ID), []);
  assert.deepEqual(filterPhotos([], "facebook"), []);
});

test("the list is capped so one listing cannot carry a gallery", () => {
  const many = Array.from(
    { length: 20 },
    (_, i) => `https://images.nobroker.in/images/${ID}/${ID}_${i}`
  );
  assert.equal(filterPhotos(many, "nobroker", ID).length, 8);
});
