export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, code } = req.body;

  const apiKey = process.env.SMS_RU_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'SMS_RU_API_KEY not set' });
  }

  const response = await fetch('https://sms.ru/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      api_id: apiKey,
      to: phone,
      msg: `Ваш код подтверждения: ${code}`,
      json: 1,
    }),
  });

  const result = await response.json();
  res.status(200).json(result);
}
