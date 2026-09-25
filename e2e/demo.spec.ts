import { expect, test } from "@playwright/test";

test("dashboard lists the sample offer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Oferty" })).toBeVisible();
  await expect(page.getByText("3 pokoje z balkonem, 58 m²")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
});

test("public offer page shows the 3D model and room area on click", async ({ page }) => {
  await page.goto("/o/podgorze-58");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("3 pokoje z balkonem, 58 m²");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Wizualizacja poglądowa").first()).toBeVisible();
  await page.getByRole("button", { name: /^Sypialnia 13,6 m²$/ }).last().click();
  await expect(page.getByRole("heading", { name: "Sypialnia · 13,6 m²" })).toBeVisible();
});

test("agent creates an offer from room areas only", async ({ page }) => {
  await page.goto("/oferty/nowa");
  await page.getByPlaceholder("ul. Lipowa 5").fill("ul. Testowa 1");
  await page.getByRole("button", { name: "Dalej →" }).click();
  await expect(page.getByText("zgadza się")).toBeVisible();
  await page.getByRole("button", { name: "Dalej →" }).click();
  await page.getByRole("button", { name: "Dalej →" }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Zapisz ofertę" }).click();
  await expect(page).toHaveURL(/\/oferty\/[0-9a-f]{8}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 pokoje z balkonem, 52 m²");
});

test("photo-to-3D page is reachable from the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Ze zdjęcia do 3D" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ze zdjęć do filmu i 3D");
  await expect(page.getByText("Wybierz lub zrób zdjęcia pokoi")).toBeVisible();
});

test("walk mode: the visitor starts in the hallway and walks to the bedroom", async ({ page }) => {
  await page.goto("/oferty/podgorze-58");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Spacer", exact: true }).click();
  await expect(page.getByText("Przedpokój · 8,3 m²")).toBeVisible();
  await page.locator("aside").getByRole("button", { name: /^Sypialnia/ }).click();
  await expect(page.getByText("Sypialnia · 13,6 m²")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Z góry", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rzut z góry" })).toBeVisible();
});
