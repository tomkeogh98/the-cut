// Devices & sync: connect this device (token or setup link) and pair new ones (link / QR code).
import { esc } from "./util.js?v=13";
import { configured, connectDevice, pairLink, store, syncNow } from "./store.js?v=13";
import { $, toast } from "./ui.js?v=13";

const QR_SRC = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const QR_SRI = "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1";

const ago = (d) => {
  if (!d) return "not yet";
  const m = Math.round((Date.now() - d) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
};

// The token form. `intro` lets the first-run screen word it differently.
export function connectForm(st, { intro = "", submit = "Connect this device" } = {}) {
  return `<form class="connect-form" id="connectForm">
    ${intro}
    <label>Token <input name="token" type="password" autocomplete="off" value="${esc(st.token)}" placeholder="github_pat_…"></label>
    <details class="fine"><summary>Data repo (${esc(st.repo)})</summary><label>Repo <input name="repo" value="${esc(st.repo)}"></label></details>
    <button class="btn primary">${esc(submit)}</button>
    <p class="fine" id="connectMsg" role="status"></p>
  </form>`;
}

export function devicesCard(st) {
  const on = configured() && store.sync.status !== "error";
  return `<section class="card devices" id="devices">
    <h2>Devices & sync</h2>
    ${on ? `<p class="sync-ok"><i></i> <b>This device is connected</b> to ${esc(st.repo)} · synced ${ago(store.sync.lastSynced)}</p>
      <h3 class="label">Add another laptop or phone</h3>
      <p>On the other device, scan this code with the camera, or open the setup link. It connects in one tap: no token pasting.</p>
      <div class="pair">
        <div class="qr" id="qr" aria-label="QR code with a setup link for another device"><button class="btn" type="button" id="showQr">Show QR code</button></div>
        <div class="pair-actions">
          <button class="btn primary" type="button" id="copyLink">Copy setup link</button>
          ${navigator.share ? `<button class="btn" type="button" id="shareLink">Send to my other device…</button>` : ""}
          <button class="btn ghost" type="button" id="syncNowBtn">Sync now</button>
          <p class="fine">The link contains your sync token. Anyone with it can read and edit your The Cut data, so only open it on your own devices and don't post it anywhere. If it leaks, delete the token on GitHub and make a new one.</p>
        </div>
      </div>
      <details><summary class="fine">Change token or repo</summary>${connectForm(st, { submit: "Save & reconnect" })}</details>`
    : `<p class="warn-line"><b>${configured() ? "Sync isn't working on this device." : "This device isn't syncing yet."}</b> ${configured() ? esc(store.sync.message) : "Anything you log here stays here until you connect it."}</p>
      <p><b>Already connected on another device?</b> Open Settings there and use <i>Copy setup link</i> or the QR code: that's the easiest way.</p>
      <details ${configured() ? "open" : ""}><summary><b>Or paste a token</b></summary>
        <ol class="fine steps">
          <li>Create a fine-grained token at <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens</a> (or reuse the one from your other device).</li>
          <li>Repository access → Only select repositories → <b>the-cut-data</b>.</li>
          <li>Permissions → Repository → <b>Contents: Read and write</b>. Generate it and paste it below.</li>
        </ol>
        ${connectForm(st)}
      </details>`}
  </section>`;
}

export function wireConnectForm(root, after) {
  const form = $("#connectForm", root);
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const msg = $("#connectMsg", root);
    msg.textContent = "Connecting…";
    try {
      const name = await connectDevice(String(f.get("repo") || store.settings.repo), String(f.get("token") || ""));
      toast(`Connected to ${name}. Everything's in sync.`);
      after?.();
    } catch (err) { msg.textContent = err.message; }
  });
}

function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = QR_SRC; s.integrity = QR_SRI; s.crossOrigin = "anonymous";
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => reject(new Error("Couldn't load the QR code generator. Use the setup link instead."));
    document.head.append(s);
  });
}

export function wireDevices(root, after) {
  wireConnectForm(root, after);
  $("#copyLink", root)?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(pairLink()); toast("Setup link copied. Open it on your other device."); }
    catch { prompt("Copy this setup link:", pairLink()); }
  });
  $("#shareLink", root)?.addEventListener("click", () => navigator.share({ title: "The Cut setup link", url: pairLink() }).catch(() => {}));
  $("#syncNowBtn", root)?.addEventListener("click", async () => { await syncNow(); after?.(); });
  $("#showQr", root)?.addEventListener("click", async () => {
    const box = $("#qr", root);
    try {
      const qrcode = await loadQr();
      const qr = qrcode(0, "M");
      qr.addData(pairLink());
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    } catch (err) { box.textContent = err.message; }
  });
}
