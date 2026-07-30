const WORKFLOW_KEY = "mocksy-listing-workflow-v1";
const DATABASE_NAME = "mocksy-listing-workflow";
const DATABASE_VERSION = 1;
const ASSET_STORE = "assets";

export const WORKFLOW_STEPS = Object.freeze(["artwork", "dpi", "mockups", "seo", "review"]);

function browserStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function makeId(prefix) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createListingWorkflow() {
  const now = new Date().toISOString();
  const workflow = {
    id: makeId("listing"),
    status: "active",
    currentStep: "artwork",
    createdAt: now,
    updatedAt: now,
    readyAssets: [],
    selectedAssetId: "",
    completed: { artwork: false, dpi: false, mockups: false, seo: false, review: false },
    mockupCount: 0,
    mockupAssetIds: [],
    seoResult: null,
    draftListing: null,
  };
  saveListingWorkflow(workflow);
  return workflow;
}

export function loadListingWorkflow() {
  try {
    const parsed = JSON.parse(browserStorage()?.getItem(WORKFLOW_KEY) || "null");
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function saveListingWorkflow(workflow) {
  const next = { ...workflow, updatedAt: new Date().toISOString() };
  browserStorage()?.setItem(WORKFLOW_KEY, JSON.stringify(next));
  return next;
}

export function updateListingWorkflow(workflowId, patch) {
  const current = loadListingWorkflow();
  if (!current || current.id !== workflowId) return null;
  const nextPatch = typeof patch === "function" ? patch(current) : patch;
  return saveListingWorkflow({ ...current, ...nextPatch });
}

export function setListingWorkflowStep(workflowId, step, patch = {}) {
  return updateListingWorkflow(workflowId, (current) => ({
    ...patch,
    currentStep: step,
    completed: {
      ...current.completed,
      ...WORKFLOW_STEPS.slice(0, Math.max(0, WORKFLOW_STEPS.indexOf(step))).reduce((result, item) => ({ ...result, [item]: true }), {}),
      ...(patch.completed || {}),
    },
  }));
}

export function prepareListingReview(workflowId, seoResult) {
  return updateListingWorkflow(workflowId, (current) => ({
    status: "active",
    currentStep: "review",
    completed: { ...current.completed, artwork: true, dpi: true, mockups: true, seo: true, review: false },
    seoResult,
  }));
}

export function completeListingWorkflow(workflowId, draftListing) {
  return updateListingWorkflow(workflowId, (current) => ({
    status: "complete",
    currentStep: "review",
    completed: { ...current.completed, artwork: true, dpi: true, mockups: true, seo: true, review: true },
    draftListing,
  }));
}

function openDatabase() {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.reject(new Error("This browser cannot save workflow files."));
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        const store = database.createObjectStore(ASSET_STORE, { keyPath: "id" });
        store.createIndex("workflowId", "workflowId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Workflow storage could not be opened."));
  });
}

function databaseRequest(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, mode);
    const store = transaction.objectStore(ASSET_STORE);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Workflow file storage failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Workflow file storage failed."));
    };
  }));
}

export async function saveWorkflowAsset({ workflowId, file, blob, dimensions, optimized }) {
  const id = makeId("asset");
  const record = {
    id,
    workflowId,
    name: file.name,
    type: blob.type || file.type,
    lastModified: file.lastModified || Date.now(),
    blob,
    size: blob.size,
    dimensions,
    optimized: Boolean(optimized),
    createdAt: new Date().toISOString(),
  };
  await databaseRequest("readwrite", (store) => store.put(record));
  return record;
}

export async function saveWorkflowListingImage({
  workflowId,
  blob,
  name,
  prompt = "",
  aspectRatio = "",
  width = 0,
  height = 0,
}) {
  const id = makeId("listing-image");
  const record = {
    id,
    workflowId,
    kind: "listing-image",
    name: name || `mocksy-listing-image-${Date.now()}.jpg`,
    type: blob.type || "image/jpeg",
    lastModified: Date.now(),
    blob,
    size: blob.size,
    prompt,
    aspectRatio,
    width,
    height,
    createdAt: new Date().toISOString(),
  };
  await databaseRequest("readwrite", (store) => store.put(record));
  return record;
}

export function getWorkflowAsset(assetId) {
  return databaseRequest("readonly", (store) => store.get(assetId));
}

export function getWorkflowAssets(workflowId) {
  return databaseRequest("readonly", (store) => store.index("workflowId").getAll(workflowId));
}
