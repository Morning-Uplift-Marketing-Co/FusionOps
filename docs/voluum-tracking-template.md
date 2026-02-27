# Voluum Tracking Code Template
> Auto-generated from live Voluum API data — 2026-02-27
> For use in LP Factory Wizard campaign creation

---

## Quick Reference

| Input | Example |
|---|---|
| `{TRK_DOMAIN}` | `trk.bearloannow.com` |
| `{DOMAIN}` | `bearloannow.com` |
| `{CAMPAIGN_ID}` | Voluum campaign UUID |
| `{LANDER_ID}` | Voluum lander UUID |

---

## 1. Voluum DTP Script (Direct Tracking Pixel v2)

Paste at the **bottom of `<head>` tag** in every landing page.

Replace **`{TRK_DOMAIN}`** with the campaign's tracking domain (appears 12 times).

```html
<meta http-equiv="delegate-ch" content="sec-ch-ua https://{TRK_DOMAIN}; sec-ch-ua-mobile https://{TRK_DOMAIN}; sec-ch-ua-arch https://{TRK_DOMAIN}; sec-ch-ua-model https://{TRK_DOMAIN}; sec-ch-ua-platform https://{TRK_DOMAIN}; sec-ch-ua-platform-version https://{TRK_DOMAIN}; sec-ch-ua-bitness https://{TRK_DOMAIN}; sec-ch-ua-full-version-list https://{TRK_DOMAIN}; sec-ch-ua-full-version https://{TRK_DOMAIN}"><style>.dtpcnt{opacity: 0;}</style>
<script>
    (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\s+)dtpcnt($|\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+
"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\/?click\/?($|(\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&
t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\.l="([^"]+)/)[1]);A()};
q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,"https://{TRK_DOMAIN}/d/.js","savedCep");
</script>
<noscript><link href="https://{TRK_DOMAIN}/d/.js?noscript=true&lpurl=" rel="stylesheet"/></noscript>
```

---

## 2. Google Ads Final URL Template

Use as **Final URL** in Google Ads campaigns.

```
https://{DOMAIN}?campaignid={campaignid}&adgroupid={adgroupid}&loc_physicall_ms={loc_physical_ms}&loc_interest_ms={loc_interest_ms}&matchtype={matchtype}&network={network}&creative={creative}&keyword={keyword}&placement={placement}&targetid={targetid}&gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}&cpid={CAMPAIGN_ID}&lpid={LANDER_ID}
```

### Parameter Reference

| Param | Source | Purpose |
|---|---|---|
| `campaignid` | Google Ads `{campaignid}` | Google campaign ID |
| `adgroupid` | Google Ads `{adgroupid}` | Ad group ID |
| `loc_physicall_ms` | Google Ads `{loc_physical_ms}` | Physical location |
| `loc_interest_ms` | Google Ads `{loc_interest_ms}` | Interest location |
| `matchtype` | Google Ads `{matchtype}` | Keyword match type |
| `network` | Google Ads `{network}` | Network (Search/Display) |
| `creative` | Google Ads `{creative}` | Creative ID |
| `keyword` | Google Ads `{keyword}` | Search keyword |
| `placement` | Google Ads `{placement}` | Placement URL |
| `targetid` | Google Ads `{targetid}` | Target ID |
| `gclid` | Google Ads `{gclid}` | Google Click ID |
| `gbraid` | Google Ads `{gbraid}` | Google BRAID |
| `wbraid` | Google Ads `{wbraid}` | Google WBRAID |
| `cpid` | Voluum | Campaign UUID |
| `lpid` | Voluum | Lander UUID |

---

## 3. Impression Tracking URL

For view-through conversion tracking. Set as **Impression Tracking URL** in Voluum campaign settings.

```
https://{TRK_DOMAIN}/impression/{CAMPAIGN_ID}
```

---

## 4. Offer URL Template

The click-through URL from landing page to LeadsGate form.

```
https://{DOMAIN}/apply?clickid={clickid}
```

Voluum replaces `{clickid}` with its internal click ID at runtime.

---

## 5. Voluum API — Create Full Campaign Stack

### Step 1: Create Lander
```json
POST /lander
{
  "name": "United States - {DOMAIN}",
  "namePostfix": "{DOMAIN}",
  "url": "https://{DOMAIN}",
  "landerType": "LANDER",
  "numberOfOffers": 1,
  "country": { "code": "US", "name": "United States" },
  "workspace": { "id": "a6bcc011-3079-4e0f-9059-c9e677f05e41" },
  "preferredTrackingDomain": "{TRK_DOMAIN}"
}
```

### Step 2: Create Offer
```json
POST /offer
{
  "name": "LeadsGate - United States - [Final] {DOMAIN}",
  "namePostfix": "[Final] {DOMAIN}",
  "url": "https://{DOMAIN}/apply?clickid={clickid}",
  "country": { "code": "US", "name": "United States" },
  "affiliateNetwork": { "id": "9138e734-b3db-4510-a05e-c3f47907e340" },
  "payout": { "type": "AUTO", "geoPayouts": [] },
  "workspace": { "id": "a6bcc011-3079-4e0f-9059-c9e677f05e41" },
  "currencyCode": "USD",
  "conversionTrackingMethod": "S2S_POSTBACK_URL",
  "preferredTrackingDomain": "{TRK_DOMAIN}"
}
```

### Step 3: Create Campaign
```json
POST /campaign
{
  "name": "[Google Ads] - {TS_NAME} - United States - {DOMAIN}",
  "namePostfix": "{DOMAIN}",
  "url": "https://{DOMAIN}?campaignid={campaignid}&adgroupid={adgroupid}&loc_physicall_ms={loc_physical_ms}&loc_interest_ms={loc_interest_ms}&matchtype={matchtype}&network={network}&creative={creative}&keyword={keyword}&placement={placement}&targetid={targetid}&gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}&cpid={NEW_CAMPAIGN_ID}&lpid={NEW_LANDER_ID}",
  "costModel": { "type": "NOT_TRACKED" },
  "country": { "code": "US", "name": "United States" },
  "trafficSource": { "id": "{TRAFFIC_SOURCE_ID}" },
  "redirectTarget": {
    "inlineFlow": {
      "name": "United States - inline path",
      "countries": [{ "code": "US", "name": "United States" }],
      "defaultPaths": [{
        "name": "New path",
        "active": true,
        "weight": 100,
        "landers": [{ "weight": 100, "lander": { "id": "{NEW_LANDER_ID}" } }],
        "offers": [{ "weight": 100, "offer": { "id": "{NEW_OFFER_ID}" } }],
        "offerRedirectMode": "REDIRECTLESS"
      }]
    }
  },
  "workspace": { "id": "a6bcc011-3079-4e0f-9059-c9e677f05e41" },
  "directTracking": true,
  "directTrackingLanderId": "{NEW_LANDER_ID}",
  "basic": true,
  "preferredTrackingDomain": "{TRK_DOMAIN}"
}
```

---

## 6. Active Traffic Sources (Google Ads)

| Name | ID (short) | Google CID | Integration ID |
|---|---|---|---|
| Account 57 | `92a5ab96-8a2c-43b5-8827-45dcfbd961ae` | 6109437792 | `8dea1929-9d35-46f0-afe3-e744fe83e054` |
| Account 68 | `d9afdc03-4de5-4545-8db3-b2f4782e4529` | 5992731821 | `38acefce-7589-46b7-abcb-e6f0b2d58da2` |
| Account 87 | `dce77525-432f-42bd-971d-48acc1f8e803` | 4135343774 | `b7860149-3a0d-4f46-a2b5-be4b939fdf12` |
| Account 95 | `fe56763d-6632-45ab-9071-d6e5017d14d4` | 1058911000 | `50e02cd7-3f1e-4bb3-ab2e-4bb6745de414` |
| Account 97 | `be5ba2bf-eda9-47b1-8283-33fab41c366b` | 4135343774 | `8c79a341-df0f-4630-8819-5ecdbf0fcdb3` |
| Account 102 | `df5fff5c-28c7-4d96-9ec3-e290eb1a82b6` | 2098019248 | `9692748d-91e1-4e08-a82d-6e4388828847` |
| Account 103 | `fccff61b-c2c7-4056-be77-c7d72ca4886b` | 6109437792 | `8dea1929-9d35-46f0-afe3-e744fe83e054` |
| Account 104 | `e87c7fa9-369a-43b8-896d-5decb41c0741` | 8609582370 | `9de947d7-ebdf-4bbc-b16a-e742548ee3a8` |
| Account 105 | `bd3e5ef8-655d-4104-9964-3f18f81c1d4d` | 8572770442 | `fbb63fb1-54c3-4eab-83d8-de6a87b1ecd4` |
| Account 109 | `38afa42d-d492-46c0-8f87-2ae3926a6401` | 4237148349 | `7ce44d9f-4d14-4044-858b-3265701fc431` |
| Fusion | `d836fc95-ebf7-45e3-8cdc-f5f5cbf92197` | 2900366623 | `6c3a6d19-56b3-4111-bc6d-8e9750da5b56` |

## 7. Shared Constants

| Entity | ID |
|---|---|
| Workspace | `a6bcc011-3079-4e0f-9059-c9e677f05e41` |
| Affiliate Network (LeadsGate) | `9138e734-b3db-4510-a05e-c3f47907e340` |
| Google Ads TS Template | `1492941c-9d3e-45f9-96dd-8eb6f4d4e1eb` |

---

## ⚠️ Known Issues (from API audit 2026-02-27)

1. **Currency mismatch** — Accounts 68, 95, 105, 109 set to THB instead of USD
2. **gbraid/wbraid placeholders** — Accounts 97, 103, 104 use `{var8}/{var9}` instead of `{gbraid}/{wbraid}`
3. **Duplicate Google CIDs** — Account 57 & 103 share CID 6109437792
4. **petcarefinhub offer** — currencyCode set to THB instead of USD
