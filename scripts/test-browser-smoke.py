"""Headless Chromium smoke checks of the actual release HTML, not mocked app logic.

No HTTP server: open file:// with networking disabled. Browser viewport emulation
does not establish Android hardware, camera permission, pinch or Safari support.
"""
import base64
import json
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "browser-smoke-results"
OUT.mkdir(exist_ok=True)
VERSION = json.loads((ROOT / "app.config.json").read_text(encoding="utf-8"))["version"]


def project_from_html(path):
    text = path.read_text(encoding="utf-8")
    match = re.search(r'<script id="imageCounterProject"[^>]*>(.*?)</script>', text, re.S)
    assert match, "Missing exported project data"
    return json.loads(match.group(1))


def session(browser, path, label, *, width=1280, height=900, mobile=False):
    context = browser.new_context(
        viewport={"width": width, "height": height}, device_scale_factor=1,
        is_mobile=mobile, has_touch=mobile, locale="en-US", offline=True,
        accept_downloads=True, service_workers="block"
    )
    errors, requests = [], []
    context.on("request", lambda req: requests.append(req.url)
               if req.url.startswith(("http://", "https://", "ws://", "wss://")) else None)
    context.add_init_script("""window.__smokeCsp = [];
    addEventListener('securitypolicyviolation', e => {
      window.__smokeCsp.push({uri:e.blockedURI,directive:e.effectiveDirective});
    });""")
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda msg: print(f"[{label}] console {msg.type}: {msg.text}", flush=True)
            if msg.type in ("error", "warning") or msg.text.startswith("[worker-smoke]") else None)
    context.add_init_script("""(() => {
      // Observe existing worker messages, never change their contents or timing.
      const OriginalWorker = window.Worker;
      window.Worker = new Proxy(OriginalWorker, {
        construct(target, args, newTarget) {
          const worker = Reflect.construct(target, args, newTarget);
          worker.addEventListener('message', e => {
            if (e.data?.phase === 'error') console.error('[worker-smoke]', e.data.code, e.data.detail);
            else if (e.data?.phase) console.log('[worker-smoke]', e.data.phase);
          });
          worker.addEventListener('error', e => console.error('[worker-smoke] error', e.message));
          return worker;
        }
      });
    })()""")
    page.set_default_timeout(30000)
    try:
        page.goto(path.resolve().as_uri(), wait_until="load", timeout=90000)
        expect(page.locator("#startScreen")).to_be_visible(timeout=90000)
        expect(page.locator("#versionBadge")).to_have_text("v" + VERSION)
        if page.locator("html").get_attribute("lang") != "en":
            page.locator("#langBtn").click()
        expect(page.locator("html")).to_have_attribute("lang", "en")
        return context, page, errors, requests
    except BaseException:
        page.screenshot(path=str(OUT / (label + "-startup-failure.png")))
        context.close()
        raise


def verify_browser(page, errors, requests):
    assert not errors, f"Unhandled page errors: {errors}"
    assert not requests, f"Unexpected runtime network requests: {requests}"
    violations = page.evaluate("window.__smokeCsp || []")
    assert not violations, f"CSP violations: {violations}"


def no_horizontal_overflow(page):
    widths = page.evaluate("({scroll:document.documentElement.scrollWidth,view:document.documentElement.clientWidth})")
    assert widths["scroll"] <= widths["view"] + 1, widths


def export_project(page, path):
    page.locator("#exportBtn:visible, #mobExport:visible").first.click()
    expect(page.locator("#exportDlg")).to_be_visible()
    with page.expect_download(timeout=90000) as event:
        page.locator("#saveViewer").click()
    event.value.save_as(str(path))
    page.locator("#exportDlg .dlg-close").click()
    return project_from_html(path)


def desktop(browser, path, label):
    context, page, errors, requests = session(browser, path, label)
    try:
        page.locator("#sampleBtn").click()
        expect(page.locator("#workspace")).to_be_visible()
        expect(page.locator("#currentImageName")).to_have_text("sample-1.jpg")
        page.locator("#pointMode").click()
        page.locator("#canvas").click()
        expect(page.locator("#summaryTotal")).to_have_text("1")
        page.locator("#undoBtn").click()
        expect(page.locator("#summaryTotal")).to_have_text("0")
        page.locator("#redoBtn").click()
        expect(page.locator("#summaryTotal")).to_have_text("1")
        # Reference uses normalized bounds around the first round part of the
        # built-in sample; success does not require a particular detection count.
        page.locator("#workspaceDetect").click()
        expect(page.locator("#autoDlg")).to_be_visible()
        page.locator("#autoBoundsDetails summary").click()
        for field, value in (("Left", "3.5"), ("Top", "14"), ("Right", "8.5"), ("Bottom", "22")):
            page.locator("#auto" + field).fill(value)
        page.locator("#autoAddBounds").click()
        expect(page.locator("#autoSaveDetect")).to_be_enabled()
        page.locator("#autoSaveDetect").click()
        expect(page.locator("#autoDlg")).to_be_hidden()
        expect(page.locator("#quickProgressText")).to_contain_text(
            re.compile(r"Finished|Stopped on error|Cancelled|Work changed"), timeout=180000
        )
        status = page.locator("#quickProgressText").inner_text()
        rows = page.locator("#quickResults").text_content()
        print(f"[{label}] detection: {status} | {rows}", flush=True)
        assert "Finished" in status, f"Detection failed: {status}; rows: {rows}"
        work = OUT / (label + "-work.html")
        project = export_project(page, work)
        assert len(project["images"]) == 2
        assert any(m["shape"] == "point" for m in project["images"][0]["markers"])
        assert project["images"][0]["detectionChecks"], "No successful detection check"
        assert any(not check["reviewed"] for check in project["images"][0]["detectionChecks"])
        assert any(cat.get("detectionReference") for cat in project["categories"])
        expect(page.locator("#saveState")).to_have_text("Saved in this browser", timeout=90000)
        verify_browser(page, errors, requests)
        page.screenshot(path=str(OUT / (label + "-desktop.png")))
        # IndexedDB restore is a separate test from explicit HTML import.
        page.reload(wait_until="load", timeout=90000)
        expect(page.locator("#restoreDraft")).to_be_visible(timeout=90000)
        page.locator("#restoreDraft").click()
        expect(page.locator("#currentImageName")).to_have_text("sample-1.jpg")
        expect(page.locator("#summaryTotal")).to_have_text(str(sum(len(im["markers"]) for im in project["images"])))
        verify_browser(page, errors, requests)
    except BaseException:
        page.screenshot(path=str(OUT / (label + "-desktop-failure.png")))
        raise
    finally:
        context.close()

    # Reopen exported work in an independent browser context.
    context, page, errors, requests = session(browser, path, label + "-import")
    try:
        page.locator("#viewerInput").set_input_files(str(work))
        expect(page.locator("#currentImageName")).to_have_text("sample-1.jpg", timeout=90000)
        restored = export_project(page, OUT / (label + "-roundtrip.html"))
        assert [im["id"] for im in restored["images"]] == [im["id"] for im in project["images"]]
        for old, new in zip(project["images"], restored["images"]):
            assert old["markers"] == new["markers"]
            assert old.get("detectionChecks", []) == new.get("detectionChecks", [])
        assert [cat.get("detectionReference") for cat in restored["categories"]] == [
            cat.get("detectionReference") for cat in project["categories"]
        ]
        verify_browser(page, errors, requests)
    except BaseException:
        page.screenshot(path=str(OUT / (label + "-import-failure.png")))
        raise
    finally:
        context.close()
    return project


def narrow(browser, path, label, project, width):
    label = f"{label}-{width}"
    context, page, errors, requests = session(browser, path, label, width=width, height=844, mobile=True)
    try:
        no_horizontal_overflow(page)
        page.locator("#langBtn").click()
        expect(page.locator("html")).to_have_attribute("lang", "ja")
        no_horizontal_overflow(page)
        # Exercise actual file-input path using a sample raster and long filename.
        im = project["images"][0]
        data = base64.b64decode(im["dataUrl"].split(",", 1)[1])
        suffix = "webp" if im["dataUrl"].startswith("data:image/webp") else "jpg"
        photo_name = "long-sample-photo-" * 7 + "." + suffix
        page.locator("#filesInput").set_input_files({"name": photo_name, "mimeType": im["dataUrl"].split(";", 1)[0][5:], "buffer": data})
        expect(page.locator("#workspace")).to_be_visible()
        expect(page.locator("#currentImageName")).to_have_text(photo_name)
        no_horizontal_overflow(page)
        page.locator("#langBtn").click()
        expect(page.locator("html")).to_have_attribute("lang", "en")
        no_horizontal_overflow(page)
        page.locator("#helpBtn").click()
        expect(page.locator("#helpDlg")).to_be_visible()
        assert page.locator("#helpDlg").evaluate("(d) => d.getBoundingClientRect().width <= innerWidth + 1")
        page.locator("#helpDlg .dlg-close").click()
        verify_browser(page, errors, requests)
        page.screenshot(path=str(OUT / (label + "-mobile.png")))
    except BaseException:
        page.screenshot(path=str(OUT / (label + "-failure.png")))
        raise
    finally:
        context.close()


if __name__ == "__main__":
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for filename in ("index.html", "index.self-extract.html"):
                path = ROOT / "dist" / filename
                label = path.stem
                project = desktop(browser, path, label)
                for width in (320, 390):
                    narrow(browser, path, label, project, width)
                print(f"[PASS] {filename}: offline direct file, AI, autosave, export/import, 320/390px JA/EN", flush=True)
        finally:
            browser.close()
