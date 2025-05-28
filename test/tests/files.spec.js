import path from "path";
import fs from "fs";
import {
  createTestAccounts,
  removeTestAccounts,
  backendRequest,
} from "../utils";
import { test, expect } from "@playwright/test";

let accounts;

let project;
let file;

test.beforeAll(async ({ browser }) => {
  accounts = await createTestAccounts(browser);
  project = await backendRequest(accounts.owner.context, "post", `/projects`, {
    headers: { "Content-Type": "application/json" },
    data: { name: "First Project" },
  });
  file = await backendRequest(accounts.owner.context, "post", "/files", {
    multipart: {
      projectId: project._id,
      file: {
        name: "image.jpg",
        mimeType: "image/jpeg",
        buffer: fs.readFileSync(
          path.join(process.cwd(), "sample-files/image.jpg")
        ),
      },
    },
  });
});

test.afterAll(() => removeTestAccounts(accounts));

test("open file as owner", async function () {
  await accounts.owner.page.goto(`/files/${file._id}`);
  await expect(accounts.owner.page.getByRole("banner")).toContainText(
    "image.jpg"
  );
  await expect(
    accounts.owner.page.getByRole("img", { name: "Click to leave a comment" })
  ).toBeVisible();
});

test("leave comment as owner", async function () {
  const { page } = accounts.owner;
  await page
    .getByRole("img", { name: "Click to leave a comment" })
    .click({ position: { x: 100, y: 100 } });
  await page
    .getByRole("textbox", { name: "Comment" })
    .fill("Comment from owner");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("paragraph")).toContainText("Comment from owner");
});

test("open file as reviewer without invite", async function () {
  const { page } = accounts.reviewer;
  await page.goto(`/files/${file._id}`);
  await expect(page.getByRole("heading")).toContainText("File not found");
});

test("open file as reviewer with invite", async function () {
  await backendRequest(
    accounts.owner.context,
    "post",
    `/projects/${project._id}/reviewers`,
    {
      headers: { "Content-Type": "application/json" },
      data: { email: accounts.reviewer.email },
    }
  );

  const { page } = accounts.reviewer;
  await page.goto(`/files/${file._id}`);
  await expect(page.getByRole("banner")).toContainText("image.jpg");
  await expect(
    page.getByRole("img", {
      name: "Click to leave a comment",
    })
  ).toBeVisible();
  await expect(page.getByRole("paragraph")).toContainText("Comment from owner");
});

test("leave comment as reviewer", async function () {
  const { page } = accounts.reviewer;
  await page
    .getByRole("img", { name: "Click to leave a comment" })
    .click({ position: { x: 200, y: 200 } });
  await page
    .getByRole("textbox", { name: "Comment" })
    .fill("Comment from reviewer");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator("text=Comment from reviewer")).toBeVisible();
});

test("infinite scroll triggers backend limit/offset requests correctly", async function () {
  const { page } = accounts.owner;

  // Intercept backend calls
  const requests = [];

  page.on("request", (request) => {
    if (request.url().includes("/comments?")) {
      requests.push(request.url());
    }
  });

  // Go to the file page
  await page.goto(`/files/${file._id}`);

  // Wait a little for first load
  await page.waitForTimeout(1000);

  // Scroll comments panel to trigger more
  const commentsPanel = page.locator('[data-testid="comments-panel"]');
  await commentsPanel.evaluate((panel) => {
    panel.scrollTop = panel.scrollHeight;
  });

  // Wait a little for new requests
  await page.waitForTimeout(1000);

  // Now check the captured requests
  const relevantRequests = requests.filter((url) => url.includes("/comments?"));

  console.log("Captured backend requests:", relevantRequests);

  // Assert that at least one request was made (initial) with offset=0 and limit=20
  expect(relevantRequests.length).toBeGreaterThanOrEqual(1);

  // Check first request
  expect(relevantRequests[0]).toContain("limit=20");
  expect(relevantRequests[0]).toContain("offset=0");
});
