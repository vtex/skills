#!/usr/bin/env python3
"""
preprocess_ki.py — Rebuild KI index files from a Zendesk export.

Usage:
    python3 preprocess_ki.py <path-to-zendesk-export.json> [--output-dir <dir>]

Output:
    ki-index.json       — Lean index of all KI tickets (~1.4 MB)
    ki-product-map.json — Inverted map: product area → tickets (~480 KB)

Run this script whenever a new Zendesk export is available.
The output files should be committed to the vtex/skills repo under ki/data/.
"""

import json
import re
import os
import sys
import argparse
from collections import defaultdict, Counter
from datetime import datetime

# ─── ARGUMENT PARSING ────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Preprocess Zendesk KI export into lean index files.")
parser.add_argument("input", help="Path to the Zendesk export JSON file (e.g., tikets-KI.json)")
parser.add_argument("--output-dir", "-o", default=".", help="Output directory for generated files (default: current dir)")
args = parser.parse_args()

INPUT_FILE = args.input
OUTPUT_DIR = args.output_dir
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def parse_field(val):
    """Parse JSON-encoded string fields (Zendesk stores some fields as strings)."""
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, ValueError):
            return val
    return val

# ─── TAG → SEMANTIC FIELD MAPS ───────────────────────────────────────────────

COMPLEXITY_MAP = {
    'complexity__low': 'low',
    'complexity__moderate': 'moderate',
    'complexity__high': 'high',
    'complexity__very_high': 'very_high',
}

STATUS_MAP = {
    'known_issue_status_backlog': 'backlog',
    'known_issue_status_no_fix': 'no_fix',
    'known_issue_status_scheduled': 'scheduled',
    'known_issue_status_fixed': 'fixed',
}

FIX_EFFORT_MAP = {
    'product_fix_effort_unknown': 'unknown',
    'product_fix_effort_low': 'low',
    'product_fix_effort_moderate': 'moderate',
    'product_fix_effort_high': 'high',
}

# ─── TAG → PRODUCT AREA PATTERNS ─────────────────────────────────────────────
# Order matters: more specific patterns first

AREA_PATTERNS = [
    (r'^commerce_capabilities_checkout_ui', 'checkout_ui'),
    (r'^commerce_capabilities_checkout_api', 'checkout_api'),
    (r'^commerce_capabilities_checkout', 'checkout'),
    (r'^commerce_capabilities_catalog_category', 'catalog_categories'),
    (r'^commerce_capabilities_catalog_sku', 'catalog_sku'),
    (r'^commerce_capabilities_catalog_product', 'catalog_products'),
    (r'^commerce_capabilities_catalog_catalog_api', 'catalog_api'),
    (r'^commerce_capabilities_catalog', 'catalog'),
    (r'^commerce_capabilities_payments_marketplace', 'payments_marketplace'),
    (r'^commerce_capabilities_payments_conditions', 'payments_conditions'),
    (r'^commerce_capabilities_payments_complete_transaction', 'payments_transactions'),
    (r'^commerce_capabilities_payments_customer_credit', 'customer_credit'),
    (r'^commerce_capabilities_payments_giftcards', 'gift_cards'),
    (r'^commerce_capabilities_payments_my_cards', 'payments_cards'),
    (r'^commerce_capabilities_payments', 'payments'),
    (r'^commerce_capabilities_order_management_subscriptions', 'subscriptions'),
    (r'^commerce_capabilities_order_management', 'order_management'),
    (r'^commerce_capabilities_store_framework', 'store_framework'),
    (r'^commerce_capabilities_promotions', 'promotions'),
    (r'^commerce_capabilities_pricing', 'pricing'),
    (r'^commerce_capabilities_marketplace', 'marketplace'),
    (r'^commerce_capabilities_logistics', 'logistics'),
    (r'^commerce_capabilities_search', 'search'),
    (r'^commerce_capabilities_b2b', 'b2b'),
    (r'^commerce_capabilities_portal', 'cms_portal'),
    (r'^commerce_capabilities_connections', 'integrations'),
    (r'^xp_shopping__checkout', 'checkout'),
    (r'^xp_shopping__gift_list', 'gift_list'),
    (r'^xp_shopping__unikey', 'unikey'),
    (r'^xp_shopping__portal', 'cms_portal'),
    (r'^xp_shopping__', 'shopping_experience'),
    (r'^xp_merch__catalog__search', 'search'),
    (r'^xp_merch__catalog__import', 'catalog_import'),
    (r'^xp_merch__catalog', 'catalog'),
    (r'^xp_merch__promotions', 'promotions'),
    (r'^xp_merch__pricing', 'pricing'),
    (r'^xp_merch__cms', 'cms_portal'),
    (r'^xp_merch__new_collections', 'catalog'),
    (r'^xp_merch__xml', 'catalog'),
    (r'^xp_merch__', 'merchandising'),
    (r'^xp_post_purchase__orders', 'order_management'),
    (r'^xp_post_purchase__logistics', 'logistics'),
    (r'^xp_post_purchase__subscription', 'subscriptions'),
    (r'^xp_post_purchase__message_center', 'message_center'),
    (r'^xp_post_purchase__my_orders', 'order_management'),
    (r'^xp_post_purchase__', 'post_purchase'),
    (r'^xp_developer__master_data', 'master_data'),
    (r'^xp_developer__vtex_io', 'vtex_io'),
    (r'^xp_developer__', 'developer_experience'),
    (r'^xp_identity__vtex_id', 'vtex_id'),
    (r'^xp_identity__license_manager', 'license_manager'),
    (r'^xp_identity__', 'identity'),
    (r'^xp_channels__amazon', 'marketplace_amazon'),
    (r'^xp_channels__', 'channels'),
    (r'^xp_financial__pci', 'payments_gateway'),
    (r'^xp_financial__', 'financial'),
    (r'^payments__gateway', 'payments_gateway'),
    (r'^payments__gift_card', 'gift_cards'),
    (r'^payments__customer_credit', 'customer_credit'),
    (r'^payments__vtex_payment', 'vtex_payment'),
    (r'^store_setup__vtex_id', 'vtex_id'),
    (r'^store_setup__', 'store_setup'),
]

# ─── SUBJECT KEYWORD FALLBACK ─────────────────────────────────────────────────
# Used when no product-area tags found on a ticket

SUBJECT_KEYWORDS = [
    (r'\bcheckout\b', 'checkout'),
    (r'\bcatalog\b|\bsku\b|\bproduct.?management\b', 'catalog'),
    (r'\bpayment\b|\bpayments\b|\btransaction\b|\bgateway\b', 'payments'),
    (r'\border\b|\boms\b|\bfulfillment\b|\binvoice\b', 'order_management'),
    (r'\bstore.?framework\b|\bvtex.?io\b|\bstore.?builder\b|\bblocks?\b', 'store_framework'),
    (r'\bpromotion\b|\bcoupon\b|\bdiscount\b', 'promotions'),
    (r'\bpric(e|ing)\b', 'pricing'),
    (r'\bmarketplace\b|\bseller\b', 'marketplace'),
    (r'\bshipping\b|\blogistic\b|\bdelivery\b|\bpick.?up\b|\binventory\b', 'logistics'),
    (r'\bsearch\b|\bautocomplete\b|\bfacet\b', 'search'),
    (r'\bb2b\b|\borgani[sz]ation\b', 'b2b'),
    (r'\bcms\b|\bportal\b|\btemplate\b|\blayout\b|\brewriter\b', 'cms_portal'),
    (r'\bmaster.?data\b|\bcrm\b', 'master_data'),
    (r'\blogin\b|\bauth\b|\bauthentication\b|\bsso\b|\boauth\b|\bpassword\b|\baccess.?code\b', 'vtex_id'),
    (r'\bnode\b|\bnpm\b|\bbuilder.?hub\b', 'vtex_io'),
    (r'\banalytics\b|\breport\b|\bdashboard\b', 'analytics'),
    (r'\bsubscription\b', 'subscriptions'),
    (r'\bgift.?card\b', 'gift_cards'),
    (r'\bcustomer.?credit\b', 'customer_credit'),
    (r'\bsegment\b|\bcookie\b|\bsession\b', 'shopping_experience'),
    (r'\blicense.?manager\b|\baccount.?management\b|\buser.?permission\b', 'license_manager'),
    (r'\bxml\b|\bfeed\b|\bintegrat\b|\bbridge\b', 'integrations'),
    (r'\brecaptcha\b', 'checkout'),
    (r'\bsplit.?payment\b|\bpayout\b', 'payments_marketplace'),
    (r'\bunikey\b', 'unikey'),
    (r'\bmy.?account\b|\bmy.?orders\b', 'order_management'),
]

def get_product_areas(tags, subject=''):
    areas = set()
    for tag in tags:
        for pattern, area in AREA_PATTERNS:
            if re.match(pattern, tag):
                areas.add(area)
                break
    if not areas and subject:
        subj_lower = subject.lower()
        for pattern, area in SUBJECT_KEYWORDS:
            if re.search(pattern, subj_lower):
                areas.add(area)
    return sorted(areas)

def get_capability_tags(tags):
    return [
        t for t in tags
        if (t.startswith('commerce_capabilities_') or
            t.startswith('xp_') or
            t.startswith('payments__') or
            t.startswith('store_setup__'))
    ]

# ─── GITHUB REPO → PRODUCT AREA MAP ──────────────────────────────────────────
# Add new repos here as needed — this is the main place to extend coverage.

REPO_TO_AREAS = {
    # Checkout
    "checkout-ui-custom": ["checkout_ui", "checkout"],
    "checkout-ui-settings": ["checkout_ui", "checkout"],
    "checkout": ["checkout_api", "checkout"],
    "vtex.checkout-ui-template": ["checkout_ui", "checkout"],
    "checkout-ui-template": ["checkout_ui", "checkout"],
    "checkout-graphql": ["checkout_api", "checkout"],
    "checkout-resources": ["checkout"],
    # Catalog
    "catalog": ["catalog"],
    "catalog-api-proxy": ["catalog_api", "catalog"],
    "search-graphql": ["search", "catalog_api"],
    "search-resolver": ["search"],
    "intelligent-search-api": ["search"],
    "store-graphql": ["catalog", "checkout"],
    # Payments
    "payment-provider-protocol": ["payments_gateway", "payments"],
    "payments-gateway": ["payments_gateway", "payments"],
    "vtex-payment": ["vtex_payment", "payments"],
    "gift-card-hub": ["gift_cards"],
    "customer-credit": ["customer_credit"],
    # Order Management
    "orders-feed-sdk": ["order_management"],
    "oms": ["order_management"],
    "orders-graphql": ["order_management"],
    "vtex.return-app": ["order_management"],
    "return-app": ["order_management"],
    "subscriptions": ["subscriptions"],
    "subscriptions-graphql": ["subscriptions"],
    # Store Framework / VTEX IO
    "store-framework": ["store_framework"],
    "store-builder": ["store_framework", "vtex_io"],
    "render-runtime": ["store_framework", "vtex_io"],
    "rewriter": ["cms_portal"],
    "builder-hub": ["vtex_io"],
    "toolbelt": ["vtex_io"],
    "node-vtex-api": ["vtex_io"],
    "store-components": ["store_framework"],
    "product-list": ["store_framework"],
    "minicart": ["store_framework"],
    "shelf": ["store_framework"],
    "product-context": ["store_framework"],
    "vtex-app-store": ["vtex_io"],
    # Promotions
    "promotions-graphql": ["promotions"],
    "coupons": ["promotions"],
    # Pricing
    "pricing": ["pricing"],
    "price-definition": ["pricing"],
    # Marketplace
    "channel-manager": ["marketplace", "integrations"],
    "offer-manager": ["marketplace"],
    "seller-selector": ["marketplace"],
    # Logistics
    "logistics": ["logistics"],
    "pickup-selector": ["logistics"],
    "shipping-estimate-translator": ["logistics"],
    # Search
    "search-page-layout": ["search"],
    "search-result": ["search"],
    # CMS / Portal
    "cms-legacy": ["cms_portal"],
    "storefront": ["cms_portal"],
    "site-editor": ["cms_portal"],
    # Identity
    "vtexid": ["vtex_id", "identity"],
    "vtexid-ui": ["vtex_id"],
    "login": ["vtex_id"],
    "my-account": ["order_management", "identity"],
    # License Manager
    "license-manager": ["license_manager"],
    # Master Data
    "masterdata-ui": ["master_data"],
    "master-data-api": ["master_data"],
    # Analytics
    "analytics": ["analytics"],
    "events-handler": ["analytics"],
    # B2B
    "b2b-organizations": ["b2b"],
    "storefront-permissions": ["b2b"],
    "storefront-permissions-ui": ["b2b"],
    "b2b-quotes-graphql": ["b2b"],
    # Integrations
    "amazon-integration": ["marketplace_amazon", "channels"],
    "erp-integration": ["integrations"],
    "bridge": ["integrations"],
}

# ─── MAIN PROCESSING ──────────────────────────────────────────────────────────

print(f"[{datetime.now().strftime('%H:%M:%S')}] Loading {INPUT_FILE}...")
with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)
print(f"[{datetime.now().strftime('%H:%M:%S')}] Loaded {len(data)} tickets.")

# Build lean index
print(f"[{datetime.now().strftime('%H:%M:%S')}] Building ki-index...")
ki_index = []

for ticket in data:
    tags = parse_field(ticket.get('tags', '[]'))
    if not isinstance(tags, list):
        tags = []

    tags_set = set(tags)
    subject = ticket.get('subject', '')
    description = ticket.get('description', '') or ''

    complexity = next((COMPLEXITY_MAP[t] for t in tags if t in COMPLEXITY_MAP), 'unknown')
    status = next((STATUS_MAP[t] for t in tags if t in STATUS_MAP), 'unknown')
    fix_effort = next((FIX_EFFORT_MAP[t] for t in tags if t in FIX_EFFORT_MAP), 'unknown')
    has_workaround = 'problem_workaround_available' in tags_set
    is_public = 'is_public_yes' in tags_set

    product_areas = get_product_areas(tags, subject)
    capability_tags = get_capability_tags(tags)

    clean_subject = re.sub(r'^\[KI\]\s*', '', subject).strip()
    desc_excerpt = re.sub(r'\s+', ' ', description[:400]).strip()

    ki_index.append({
        'id': ticket['id'],
        'subject': clean_subject,
        'desc': desc_excerpt,
        'complexity': complexity,
        'fix_effort': fix_effort,
        'status': status,
        'has_workaround': has_workaround,
        'is_public': is_public,
        'product_areas': product_areas,
        'capability_tags': capability_tags,
        'zendesk_url': f"https://vtexhelp.zendesk.com/agent/tickets/{ticket['id']}",
        'created_at': ticket.get('created_at', ''),
    })

# Build product map
print(f"[{datetime.now().strftime('%H:%M:%S')}] Building ki-product-map...")
product_map = defaultdict(list)
capability_map = defaultdict(list)

for ki in ki_index:
    for area in ki['product_areas']:
        product_map[area].append({
            'id': ki['id'],
            'subject': ki['subject'],
            'complexity': ki['complexity'],
            'fix_effort': ki['fix_effort'],
            'status': ki['status'],
            'has_workaround': ki['has_workaround'],
            'url': ki['zendesk_url'],
        })
    for cap in ki['capability_tags']:
        capability_map[cap].append(ki['id'])

# Sort each area's tickets by severity
SEVERITY_ORDER = {'very_high': 0, 'high': 1, 'moderate': 2, 'low': 3, 'unknown': 4}
product_map_sorted = {}
for area, tickets in sorted(product_map.items(), key=lambda x: -len(x[1])):
    product_map_sorted[area] = {
        'count': len(tickets),
        'tickets': sorted(tickets, key=lambda t: SEVERITY_ORDER.get(t['complexity'], 4))
    }

# Stats
no_area = sum(1 for k in ki_index if not k['product_areas'])
print(f"  Total tickets: {len(ki_index)}")
print(f"  With area mapped: {len(ki_index) - no_area} ({(len(ki_index)-no_area)/len(ki_index)*100:.1f}%)")
print(f"  No area (unclassified): {no_area}")
print(f"  Complexity: {dict(Counter(k['complexity'] for k in ki_index).most_common())}")
print(f"  Status:     {dict(Counter(k['status'] for k in ki_index).most_common())}")

output_map = {
    'product_areas': product_map_sorted,
    'capability_tags': dict(capability_map),
    'repo_to_areas': REPO_TO_AREAS,
    'meta': {
        'total_tickets': len(ki_index),
        'total_areas': len(product_map_sorted),
        'total_capability_tags': len(capability_map),
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'source_file': os.path.basename(INPUT_FILE),
    }
}

# Write outputs
index_path = os.path.join(OUTPUT_DIR, 'ki-index.json')
map_path = os.path.join(OUTPUT_DIR, 'ki-product-map.json')

with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(ki_index, f, ensure_ascii=False, separators=(',', ':'))

with open(map_path, 'w', encoding='utf-8') as f:
    json.dump(output_map, f, ensure_ascii=False, separators=(',', ':'))

index_size = os.path.getsize(index_path)
map_size = os.path.getsize(map_path)
src_size = os.path.getsize(INPUT_FILE)

print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Done!")
print(f"  {index_path}: {index_size/1024:.0f} KB")
print(f"  {map_path}: {map_size/1024:.0f} KB")
print(f"  (source was {src_size/1024:.0f} KB → {(index_size+map_size)/src_size*100:.1f}% of original)")
