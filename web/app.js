const REPO_OWNER = "dare131";
const REPO_NAME = "proxy";
const BRANCH = "main";
const TYPES = ["http", "https", "socks4", "socks5"];
const RAW_ROOT = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;

const state = {
  lists: Object.fromEntries(TYPES.map((type) => [type, []])),
  stats: null,
};

const elements = {
  updatedAt: document.querySelector("#updatedAt"),
  totalCount: document.querySelector("#totalCount"),
  candidateCount: document.querySelector("#candidateCount"),
  selectedCount: document.querySelector("#selectedCount"),
  proxyOutput: document.querySelector("#proxyOutput"),
  searchInput: document.querySelector("#searchInput"),
  refreshButton: document.querySelector("#refreshButton"),
  copyButton: document.querySelector("#copyButton"),
  downloadButton: document.querySelector("#downloadButton"),
  copyChromeButton: document.querySelector("#copyChromeButton"),
  downloadChromeButton: document.querySelector("#downloadChromeButton"),
  formatRadios: [...document.querySelectorAll(".format-radio")],
  checks: [...document.querySelectorAll(".type-check")],
};

function cacheBust(url) {
  return `${url}?t=${Date.now()}`;
}

async function fetchText(path) {
  const remote = await fetch(cacheBust(`${RAW_ROOT}/${path}`));
  if (remote.ok) {
    return remote.text();
  }
  const local = await fetch(cacheBust(`/${path}`));
  if (!local.ok) {
    throw new Error(`${path} failed with ${remote.status}`);
  }
  return local.text();
}

async function loadData() {
  elements.proxyOutput.textContent = "Loading proxy lists...";
  const [statsText, ...listTexts] = await Promise.all([
    fetchText("proxies/stats.json"),
    ...TYPES.map((type) => fetchText(`proxies/${type}.txt`)),
  ]);
  state.stats = JSON.parse(statsText);
  TYPES.forEach((type, index) => {
    state.lists[type] = listTexts[index]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  });
  render();
}

function selectedTypes() {
  return elements.checks.filter((check) => check.checked).map((check) => check.value);
}

function proxySchemeForType(type) {
  return type === "https" ? "http" : type;
}

function selectedFormat() {
  return elements.formatRadios.find((radio) => radio.checked)?.value ?? "raw";
}

function formatProxy(type, line, format = selectedFormat()) {
  if (format === "raw") {
    return line;
  }
  if (format === "browser") {
    return `${proxySchemeForType(type)}://${line}`;
  }
  return `${type}://${line}`;
}

function selectedProxies() {
  const needle = elements.searchInput.value.trim().toLowerCase();
  const format = selectedFormat();
  const combined = selectedTypes().flatMap((type) =>
    state.lists[type].map((line) => formatProxy(type, line, format))
  );
  const unique = [...new Set(combined)].sort();
  return needle ? unique.filter((line) => line.toLowerCase().includes(needle)) : unique;
}

function render() {
  const proxies = selectedProxies();
  const total = TYPES.reduce((sum, type) => sum + state.lists[type].length, 0);
  elements.totalCount.textContent = new Intl.NumberFormat().format(total);
  elements.candidateCount.textContent = new Intl.NumberFormat().format(state.stats?.totalCandidates ?? 0);
  elements.updatedAt.textContent = state.stats?.updatedAt ? new Date(state.stats.updatedAt).toLocaleString() : "Waiting for first run";
  elements.selectedCount.textContent = `${new Intl.NumberFormat().format(proxies.length)} proxies`;
  TYPES.forEach((type) => {
    document.querySelector(`#${type}Count`).textContent = new Intl.NumberFormat().format(state.lists[type].length);
  });
  elements.proxyOutput.textContent = proxies.length ? proxies.join("\n") : "No proxies match the current selection.";
}

function selectedFilename() {
  const types = selectedTypes();
  const format = selectedFormat();
  const prefix = format === "browser" ? "chrome-proxy" : "proxy";
  return types.length === TYPES.length ? `${prefix}-mixed.txt` : `${prefix}-${types.join("-") || "empty"}.txt`;
}

async function copySelected(format = selectedFormat(), button = elements.copyButton) {
  const previousFormat = selectedFormat();
  if (format !== previousFormat) {
    elements.formatRadios.forEach((radio) => {
      radio.checked = radio.value === format;
    });
  }
  const text = selectedProxies().join("\n");
  await navigator.clipboard.writeText(text);
  button.textContent = "Copied";
  window.setTimeout(() => {
    button.textContent = button === elements.copyChromeButton ? "Copy Chrome" : "Copy";
  }, 1200);
  if (format !== previousFormat) {
    elements.formatRadios.forEach((radio) => {
      radio.checked = radio.value === previousFormat;
    });
  }
}

function downloadSelected(format = selectedFormat()) {
  const previousFormat = selectedFormat();
  if (format !== previousFormat) {
    elements.formatRadios.forEach((radio) => {
      radio.checked = radio.value === format;
    });
  }
  const blob = new Blob([selectedProxies().join("\n") + "\n"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = selectedFilename();
  anchor.click();
  URL.revokeObjectURL(url);
  if (format !== previousFormat) {
    elements.formatRadios.forEach((radio) => {
      radio.checked = radio.value === previousFormat;
    });
  }
}

elements.checks.forEach((check) => check.addEventListener("change", render));
elements.formatRadios.forEach((radio) => radio.addEventListener("change", render));
elements.searchInput.addEventListener("input", render);
elements.refreshButton.addEventListener("click", () => loadData().catch(showError));
elements.copyButton.addEventListener("click", () => copySelected().catch(showError));
elements.downloadButton.addEventListener("click", () => downloadSelected());
elements.copyChromeButton.addEventListener("click", () => copySelected("browser", elements.copyChromeButton).catch(showError));
elements.downloadChromeButton.addEventListener("click", () => downloadSelected("browser"));

function showError(error) {
  elements.proxyOutput.textContent = `Unable to load proxy data.\n${error.message}`;
}

loadData().catch(showError);
