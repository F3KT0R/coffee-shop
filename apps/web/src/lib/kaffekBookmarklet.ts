/**
 * Builds the "add to KaffeK basket" bookmark.
 *
 * KaffeK's login is protected by reCAPTCHA, so our server can't sign in and fill the basket itself.
 * Instead, the owner clicks this bookmark while logged in on kaffek.co.uk: it runs in their own browser
 * session and uses KaffeK's regular add-to-cart endpoint (the same one the "Add" button uses), so the
 * items land in their account's basket.
 *
 * KaffeK answers every add with HTTP 200: a refused add (e.g. more than in stock) returns a `backUrl`,
 * and an unknown product is silently ignored. The script therefore checks both the per-item answer and
 * whether the basket total actually grew by the expected amount.
 */
export interface BookmarkletItem {
  /** KaffeK internal product id. */
  id: number;
  qty: number;
  sku: string;
}

function script(items: BookmarkletItem[]): string {
  return `(async () => {
  const items = ${JSON.stringify(items)};
  if (!/(^|\\.)kaffek\\.co\\.uk$/.test(location.hostname)) {
    alert('Kafe za Vas: otvorite kaffek.co.uk (prijavljeni na svoj nalog), pa kliknite ovaj obeleživač ponovo.');
    return;
  }
  const match = document.cookie.match(/(?:^|; )form_key=([^;]+)/);
  const formKey = match ? decodeURIComponent(match[1]) : (document.querySelector('input[name=form_key]') || {}).value;
  if (!formKey) {
    alert('Kafe za Vas: KaffeK stranica još nije spremna. Osvežite je i pokušajte ponovo.');
    return;
  }
  const count = async () => {
    const r = await fetch('/customer/section/load/?sections=cart&force_new_section_timestamp=true', { credentials: 'include' });
    const j = await r.json();
    return Number((j.cart && j.cart.summary_count) || 0);
  };
  const before = await count();
  const refused = [];
  let expected = 0;
  for (const it of items) {
    try {
      const r = await fetch('/checkout/cart/add/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams({ product: String(it.id), qty: String(it.qty), form_key: formKey }),
      });
      const body = await r.text();
      if (!r.ok || body.includes('backUrl')) refused.push(it.sku + ' x' + it.qty);
      else expected += it.qty;
    } catch (e) {
      refused.push(it.sku + ' x' + it.qty);
    }
  }
  const added = (await count()) - before;
  let msg = 'Kafe za Vas: u KaffeK korpu dodato ' + added + ' kom.';
  if (refused.length) msg += '\\n\\nKaffeK je odbio (verovatno nema dovoljno na stanju):\\n' + refused.join('\\n');
  if (added < expected) msg += '\\n\\nOčekivano ' + expected + ' kom. — proverite korpu.';
  alert(msg);
  location.href = '/checkout/cart/';
})();`;
}

export function buildKaffekBookmarklet(items: BookmarkletItem[]): string {
  return `javascript:${encodeURIComponent(script(items))}`;
}
