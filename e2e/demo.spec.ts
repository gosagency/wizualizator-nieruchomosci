import { expect, test, type Page } from "@playwright/test";

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
  // the offer page compiles on first visit in dev mode, which can take a while under load
  await expect(page).toHaveURL(/\/oferty\/[0-9a-f]{8}$/, { timeout: 20_000 });
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

/** Synthetic listing and photos, so tests do not depend on a live portal. */
async function importMockListing(page: Page) {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.route("https://img.example/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: png, headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/api/import", (route) =>
    route.fulfill({
      json: {
        source: "otodom", portal: "Otodom", url: "https://www.otodom.pl/pl/oferta/test-ID0TEST",
        title: "Słoneczne 3 pokoje z balkonem", street: "ul. Testowa 7", city: "Kraków", district: "Prądnik Czerwony",
        area: 52, price: 769000, rooms: 3, floor: "3/4", description: "Opis testowy.",
        images: ["https://img.example/1.png", "https://img.example/2.png"], floorPlans: [],
        agentName: "Jan Testowy", agentPhone: "+48 500 000 000", balcony: true, separateKitchen: true,
      },
    }),
  );
  // a shared link can carry the listing: /oferty/nowa?link=…
  const listing = "https://www.otodom.pl/pl/oferta/test-ID0TEST";
  await page.goto(`/oferty/nowa?link=${encodeURIComponent(listing)}`);
  await expect(page.getByLabel("Link do ogłoszenia")).toHaveValue(listing);
  await page.getByText("To ogłoszenie naszego biura").click();
  await page.getByRole("button", { name: "Importuj ogłoszenie" }).click();
}

test("agent imports a listing from a link and the form fills itself", async ({ page }) => {
  await importMockListing(page);
  await expect(page.getByText("Zaimportowano z Otodom")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByPlaceholder("ul. Lipowa 5")).toHaveValue("ul. Testowa 7");
  await expect(page.getByPlaceholder("np. Krowodrza")).toHaveValue("Prądnik Czerwony");
  await page.getByRole("button", { name: "Dalej →" }).click();
  await expect(page.locator('input[value="Kuchnia"]')).toBeVisible();
  await expect(page.getByText("zgadza się")).toBeVisible();
  await page.getByRole("button", { name: "Dalej →" }).click();
  await expect(page.locator("figure img")).toHaveCount(2);
  await page.getByRole("button", { name: "Dalej →" }).click();
  await page.getByRole("button", { name: "Zapisz ofertę" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Słoneczne 3 pokoje z balkonem", { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Źródło ogłoszenia ↗" })).toHaveAttribute("href", "https://www.otodom.pl/pl/oferta/test-ID0TEST");
});

test("Film AI from an imported offer: pick photos, progress survives switching tabs", async ({ page }) => {
  await importMockListing(page);
  await expect(page.getByText("Zaimportowano z Otodom")).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Dalej →" }).click();
  await page.getByRole("button", { name: "Zapisz ofertę" }).click();
  await expect(page).toHaveURL(/\/oferty\/[0-9a-f]{8}$/, { timeout: 20_000 });

  // without a video server (no ComfyUI) Film AI is simply not offered; browser films still are
  await page.getByRole("tab", { name: "Filmy" }).click();
  await expect(page.getByRole("heading", { name: "Spacer 3D · poziomy 16:9" })).toBeVisible();
  await expect(page.getByText("Film AI z ruchem kamery")).toHaveCount(0);

  // stand-in for our video worker (Wan 2.2 on the owner GPU)
  const worker = "https://worker.example";
  const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" };
  let submitted = 0;
  await page.route(`${worker}/**`, (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (path === "/health") return route.fulfill({ json: { ok: true, queue: 0, frames: 49 }, headers: cors });
    if (path === "/jobs" && req.method() === "POST") return route.fulfill({ json: { id: `job${++submitted}` }, headers: cors });
    return route.fulfill({ json: { status: "running", progress: 0.4 }, headers: cors });
  });
  await page.goto(`${page.url()}?serwer=${encodeURIComponent(worker)}`);
  await page.getByRole("tab", { name: "Filmy" }).click();
  await expect(page.getByText("Serwer wideo online")).toBeVisible();
  const create = page.getByRole("button", { name: /^Utwórz film AI/ });
  await expect(create).toHaveText("Utwórz film AI (2 ujęcia)");
  await page.getByRole("button", { name: /w filmie$/ }).first().click();
  await expect(create).toHaveText("Utwórz film AI (1 ujęcie)");
  await create.click();
  await expect(page.getByText("40%")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("tab", { name: "Model 3D" }).click();
  await page.getByRole("tab", { name: "Filmy" }).click();
  await expect(page.getByText("40%")).toBeVisible();
  expect(submitted).toBe(1);
});
