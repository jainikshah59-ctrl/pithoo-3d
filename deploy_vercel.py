#!/usr/bin/env python3
"""Deploy Pithoo 3D to Vercel (free hosting) via API: upload files, create deployment."""
import sys, os, json, hashlib, urllib.request, urllib.error
sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_response_body

CRED = "custom.vercel"
API = "https://api.vercel.com"
ROOT = os.path.dirname(os.path.abspath(__file__))
SKIP = {"deploy_gh.py", "deploy_vercel.py", ".DS_Store"}

def call(method, url, data=None, raw=None, ctype="application/json", headers=None):
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    h = {"User-Agent": "muse-pithoo-3d/1.0"}
    if body: h["Content-Type"] = ctype
    if headers: h.update(headers)
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    add_surrogate_to_request(r, CRED, allowed_hosts=["api.vercel.com"])
    try:
        with urllib.request.urlopen(r) as resp:
            b = read_response_body(resp).decode()
            return resp.status, json.loads(b) if b else {}
    except urllib.error.HTTPError as e:
        eb = e.read().decode(errors="replace")
        try: ej = json.loads(eb)
        except: ej = {"raw": eb[:300]}
        return e.code, ej

def main():
    files = []
    for dp, _, fns in os.walk(ROOT):
        for fn in fns:
            if fn in SKIP or fn.startswith("."): continue
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, ROOT).replace(os.sep, "/")
            with open(full, "rb") as f: data = f.read()
            files.append({"file": rel, "sha": hashlib.sha1(data).hexdigest(),
                          "size": len(data), "data": data})
    print(f"{len(files)} files, {sum(f['size'] for f in files)//1024} KB")

    st, existing = call("GET", f"{API}/v12/files")
    have = set()
    # upload each file (dedup by sha is server-side; just upload)
    for f in files:
        st, res = call("POST", f"{API}/v12/files", raw=f["data"],
                       ctype="application/octet-stream",
                       headers={"x-vercel-digest": f["sha"]})
        if st == 200:
            print("  up", f["file"])
        else:
            print("  FAILED", f["file"], st, res); sys.exit(1)

    payload = {
        "name": "pithoo-3d",
        "project": "pithoo-3d",
        "target": "production",
        "files": [{"file": f["file"], "sha": f["sha"], "size": f["size"]} for f in files],
        "projectSettings": {"framework": None},
    }
    st, dep = call("POST", f"{API}/v13/deployments", data=payload)
    if st in (200, 201):
        print("DEPLOYED:", dep.get("url"))
    else:
        print("deploy failed", st, json.dumps(dep)[:500]); sys.exit(1)

if __name__ == "__main__":
    main()
