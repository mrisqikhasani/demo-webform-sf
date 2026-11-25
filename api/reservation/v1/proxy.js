let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const { SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET } = process.env;
  if (!SF_INSTANCE_URL || !SF_CLIENT_ID || !SF_CLIENT_SECRET) {
    throw new Error(
      "Environment variable SF_INSTANCE_URL, SF_CLIENT_ID, atau SF_CLIENT_SECRET belum diatur."
    );
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET
  });

  const res = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || "Gagal mendapatkan token OAuth Salesforce");
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + 45 * 60 * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const token = await getAccessToken();
    const { SF_INSTANCE_URL } = process.env;

    // Vercel rewrites pass the captured :path* as req.query.sfpath
    // e.g. source  /api/reservation/v1/branches/SCBD/slots?from=2024-01-01&to=2024-01-15
    //      sfpath  = "branches/SCBD/slots"
    // We also need to forward any original query params (from, to, limit, etc.)
    // Those are in req.url as the full rewritten URL — parse them out, excluding "sfpath".
    const sfpath = req.query.sfpath || "";

    // Build forwarded query string: everything from req.query except the internal "sfpath" key
    const forwardParams = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === "sfpath") continue;
      forwardParams.append(k, v);
    }
    const qs = forwardParams.toString();
    const targetUrl = `${SF_INSTANCE_URL}/services/apexrest/reservation/v1/${sfpath}${qs ? "?" + qs : ""}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }

    const sfRes = await fetch(targetUrl, fetchOptions);
    const text = await sfRes.text();

    res.setHeader("Content-Type", "application/json");
    return res.status(sfRes.status).send(text);
  } catch (err) {
    return res.status(500).json({
      error: { code: "PROXY_ERROR", message: err.message }
    });
  }
}
