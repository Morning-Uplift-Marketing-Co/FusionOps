import { generatePhone } from "./phone-gen.js";

const BUSINESS_ADDRESSES = [
  "1209 Orange St, Wilmington, DE 19801",
  "251 Little Falls Dr, Wilmington, DE 19808",
  "8 The Green, Ste A, Dover, DE 19901",
  "30 N Gould St, Ste R, Sheridan, WY 82801",
  "1603 Capitol Ave, Ste 310, Cheyenne, WY 82001",
  "5830 E 2nd St, Ste 7000, Casper, WY 82609",
  "1007 N Orange St, 4th Fl, Wilmington, DE 19801",
  "16192 Coastal Hwy, Lewes, DE 19958",
  "108 West 13th St, Wilmington, DE 19801",
  "1712 Pioneer Ave, Ste 500, Cheyenne, WY 82001",
  "99 Wall St, Ste 5868, New York, NY 10005",
  "8 The Green, Ste 14095, Dover, DE 19901",
];

function hash32(str = "") {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h >>>= 0;
  }
  return h;
}

function cleanDomain(domain = "") {
  return String(domain || "")
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim();
}

function domainLabel(domain = "", brand = "") {
  const clean = cleanDomain(domain);
  const root = clean.split(".")[0] || String(brand || "");
  return root.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function generateDomainVanityPhone(domain = "", brand = "") {
  const word = domainLabel(domain, brand) || "LOANSNOW";
  const chunkA = word.slice(0, 7);
  const chunkB = word.slice(7, 12);
  if (!chunkA) return generatePhone(domain, brand);
  if (!chunkB) return `1-800-${chunkA}`;
  return `1-800-${chunkA}-${chunkB}`;
}

export function generateBusinessAddress(domain = "", brand = "") {
  const key = `${cleanDomain(domain)}|${String(brand || "").trim().toLowerCase()}`;
  const idx = hash32(key || "default") % BUSINESS_ADDRESSES.length;
  return BUSINESS_ADDRESSES[idx] || BUSINESS_ADDRESSES[0];
}
