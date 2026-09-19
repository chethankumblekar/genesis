const port = process.env.PORT || "43123";

const req = require("http").get(
  `http://127.0.0.1:${port}/`,
  (res) => {
    res.resume();
    process.exit(res.statusCode && res.statusCode < 500 ? 0 : 1);
  }
);

req.on("error", () => process.exit(1));
req.setTimeout(4000, () => {
  req.destroy();
  process.exit(1);
});
