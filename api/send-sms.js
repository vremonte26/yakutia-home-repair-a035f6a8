export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Телефон и код обязательны' });
  }

  const apiKey = process.env.SMS_RU_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'SMS_RU_API_KEY not set' });
  }

  try {
    const params = new URLSearchParams({
      api_id: apiKey,
      to: phone,
      msg: `Ваш код для входа в МастерБул: ${code}`,
      json: 1,
    });

    const response = await fetch('https://sms.ru/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const result = await response.json();

    if (result.status === 'OK') {
      return res.status(200).json({ success: true, result });
    } else {
      return res.status(500).json({ error: result.status_text, details: result });
    }
  } catch (error) {
    console.error('Ошибка отправки SMS:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
