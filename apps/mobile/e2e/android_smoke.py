#!/usr/bin/env python3
"""Smoke test de l'APK sur émulateur Android (CI).

Parcours : lancement → onboarding → connexion démo (OTP 123456, PIN 1234) → accueil.
Pilote l'app via adb + uiautomator (aucune dépendance), capture chaque étape dans
./smoke-shots et échoue si l'app plante (FATAL EXCEPTION) ou si un écran n'apparaît pas.
"""
import os
import re
import subprocess
import sys
import time

PKG = "finance.dala.app"
SHOTS = "smoke-shots"
os.makedirs(SHOTS, exist_ok=True)


def adb(*args, check=True):
    r = subprocess.run(["adb", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        print(r.stdout, r.stderr)
    return r.stdout


def dump():
    for _ in range(3):
        out = adb("exec-out", "uiautomator", "dump", "/dev/tty", check=False)
        if "<hierarchy" in out:
            return out[out.index("<hierarchy"):]
        time.sleep(1)
    return ""


def nodes(xml):
    for m in re.finditer(r"<node ([^>]*)/?>", xml):
        attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', m.group(1)))
        yield attrs


def find(pattern, xml, cls=None):
    rx = re.compile(pattern)
    for n in nodes(xml):
        if cls and n.get("class") != cls:
            continue
        if rx.search(n.get("text", "")) or rx.search(n.get("content-desc", "")):
            return n
    return None


def wait_for(pattern, timeout=40, cls=None):
    deadline = time.time() + timeout
    while time.time() < deadline:
        xml = dump()
        n = find(pattern, xml, cls)
        if n:
            return n
        crashed()
        time.sleep(2)
    shot("echec")
    print("---- Textes visibles ----")
    print(sorted({a.get("text") or a.get("content-desc") for a in nodes(dump()) if a.get("text") or a.get("content-desc")}))
    fail(f"Élément introuvable : {pattern}")


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node["bounds"]))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
    time.sleep(1.2)


def hide_keyboard():
    """Ferme le clavier s'il est affiché (BACK uniquement dans ce cas, sinon il ferait reculer l'écran)."""
    if "mInputShown=true" in adb("shell", "dumpsys", "input_method", check=False):
        adb("shell", "input", "keyevent", "4")
        time.sleep(0.8)


def type_text(text):
    adb("shell", "input", "text", text)
    time.sleep(0.8)


step = 0


def shot(name):
    global step
    step += 1
    path = f"{SHOTS}/{step:02d}-{name}.png"
    with open(path, "wb") as f:
        f.write(subprocess.run(["adb", "exec-out", "screencap", "-p"], capture_output=True).stdout)
    print(f"📸 {path}")


def crashed():
    log = adb("logcat", "-d", "-b", "crash", check=False)
    if PKG in log and "FATAL EXCEPTION" in log:
        print(log[-4000:])
        fail("L'application a planté (FATAL EXCEPTION)")


def fail(msg):
    print(f"❌ {msg}")
    js = adb("logcat", "-d", "-s", "ReactNativeJS:*", check=False)
    print("---- Logs JS ----")
    print(js[-4000:])
    sys.exit(1)


def ok(msg):
    print(f"✅ {msg}")


adb("logcat", "-c")
adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
t0 = time.time()

wait_for(r"Épargnez intelligemment|Passer", timeout=60)
ok(f"Onboarding affiché ({time.time() - t0:.1f} s après le lancement)")
shot("onboarding")

tap(wait_for(r"Déjà inscrit"))
wait_for(r"Bon retour")
ok("Écran de connexion")
shot("connexion")

tap(wait_for(r"^Numéro de téléphone$", cls="android.widget.EditText"))
type_text("0707000000")
hide_keyboard()
wait_for(r"^07 ?07 ?00 ?00 ?00$|^0707000000$", timeout=10)
tap(wait_for(r"^Recevoir le code OTP$"))

tap(wait_for(r"^Code reçu par SMS, \d+ chiffres sur 6"))
type_text("123456")
tap(wait_for(r"^Code PIN, \d+ chiffres sur 4"))
type_text("1234")
hide_keyboard()
shot("otp-pin")

tap(wait_for(r"^Se connecter$"))
wait_for(r"Bonjour, Awa", timeout=40)
ok("Connexion réussie : accueil affiché")
time.sleep(2)
shot("accueil")

tap(wait_for(r"^Épargne$"))
wait_for(r"Total épargné")
ok("Onglet Épargne")
shot("epargne")

tap(wait_for(r"^Crédit$"))
wait_for(r"Montant éligible")
ok("Onglet Crédit")
shot("credit")

crashed()
mem = adb("shell", "dumpsys", "meminfo", PKG, check=False)
m = re.search(r"TOTAL PSS:\s+(\d+)", mem) or re.search(r"TOTAL\s+(\d+)", mem)
if m:
    print(f"ℹ️ Mémoire utilisée : {int(m.group(1)) // 1024} Mo")
ok("Smoke test Android terminé sans plantage")
