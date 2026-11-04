#!/usr/bin/env python3
"""Build prisma/seed/catalog.json from the store's public Shopify feeds.
Usage: python3 -I scripts/build-catalog-snapshot.py <store-origin>
Images are intentionally NOT copied: seed products use a placeholder image.
"""
import html, json, re, sys, urllib.request

origin = sys.argv[1].rstrip("/")

def get(path):
    req = urllib.request.Request(origin + path, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

def text(h):
    h = re.sub(r"<(br|/p|/div|/li)\s*/?>", "\n", h or "")
    h = re.sub(r"<[^>]+>", "", h)
    h = html.unescape(h).replace("\xa0", " ")
    return re.sub(r"\n\s*\n+", "\n\n", re.sub(r"[ \t]+", " ", h)).strip()

def paise(v):
    return None if v in (None, "") else int(round(float(v) * 100))

collections = get("/collections.json?limit=250")["collections"]
products = get("/products.json?limit=250")["products"]
by_handle = {p["handle"]: p for p in products}

out_collections, membership = [], {}
for pos, c in enumerate(collections):
    handles = []
    page = 1
    while True:
        batch = get(f"/collections/{c['handle']}/products.json?limit=250&page={page}")["products"]
        if not batch:
            break
        handles += [p["handle"] for p in batch]
        page += 1
    out_collections.append({"handle": c["handle"], "title": c["title"].strip().title() if c["title"].isupper() else c["title"].strip(), "position": pos})
    for i, h in enumerate(handles):
        membership.setdefault(h, []).append({"collection": c["handle"], "position": i})

out_products = []
for p in products:
    variants = []
    for i, v in enumerate(p["variants"]):
        variants.append({
            "title": v["title"],
            "sku": v.get("sku") or None,
            "pricePaise": paise(v["price"]),
            "compareAtPricePaise": paise(v.get("compare_at_price")),
            "inStock": bool(v["available"]),
            "position": i,
        })
    out_products.append({
        "handle": p["handle"],
        "title": p["title"].strip(),
        "description": text(p["body_html"]),
        "tags": p["tags"] if isinstance(p["tags"], list) else [t.strip() for t in p["tags"].split(",") if t.strip()],
        "productType": p.get("product_type") or None,
        "createdAt": p["created_at"],
        "variants": variants,
        "collections": membership.get(p["handle"], []),
    })

json.dump({"collections": out_collections, "products": out_products}, open("prisma/seed/catalog.json", "w"), indent=1, ensure_ascii=False)
print(len(out_collections), "collections,", len(out_products), "products")
