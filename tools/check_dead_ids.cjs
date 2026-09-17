// Check which dead-code promo IDs actually have HTML markup anywhere.
const { execSync } = require('child_process');
const ids = ['promoForm','promoId','promoCode','promoModal','grantVoucherModal',
  'closePromoModalBtn','btn-edit-promo','btn-del-promo','btn-toggle-promo',
  'openGrantVoucherModal','closeGrantVoucherModalBtn','btn-del-voucher',
  'tabBtnPromos','tabBtnVouchers','promoSearchInput'];
for (const id of ids) {
  const cmd = `grep -rc "id=['\\"]${id}['\\"]" public/app.js public/index.html public/dashboard.html public/track.html public/pay.html 2>/dev/null`;
  let refs = 0;
  try { refs = String(execSync(cmd, {shell:'bash'})).split('\n').filter(Boolean).reduce((a,l)=>a+parseInt(l.split(':')[1]||0),0); } catch(e){}
  console.log(`${id.padEnd(26)} ${refs} markup-refs`);
}
