const {
  test,
  expect,
} = require("/srv/dev/tools/browser/node_modules/@playwright/test");

test("landing: responsive content, anchors and account navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && url.port === "5173"
      ? route.continue()
      : route.abort();
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:5173");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Le jeu nousrapproche.",
    );
    await expect(page.getByText("Tables ouvertes 24h/24")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Découvrir l’expérience" }).click();
    await expect(page).toHaveURL(/#experience$/);
    await expect(
      page.getByRole("heading", { name: /Tout commence.*par une bonne table/ }),
    ).toBeInViewport();
  }
  await page.getByRole("link", { name: "Créer mon compte" }).first().click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(
    page.getByText("Créez votre compte", { exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("landing: keyboard access and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:5173");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
