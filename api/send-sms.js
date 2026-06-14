export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не разрешен' });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Телефон и код обязательны' });
  }

  const login = process.env.SMSC_LOGIN;
  const password = process.env.SMSC_PASSWORD;

  if (!login || !password) {
    return res.status(500).json({ error: 'SMSC_LOGIN или SMSC_PASSWORD не заданы' });
  }

  const url = `https://smsc.ru/sys/send.php?login=${login}&psw=${password}&phones=${phone}&mes=Ваш+код+для+входа+в+Времонте:+${code}&fmt=3`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error_code === 0) {
      return res.status(200).json({ success: true, sms_id: data.id });
    } else {
      return res.status(500).json({ 
        error: data.error || 'Ошибка отправки SMS', 
        error_code: data.error_code 
      });
    }
  } catch (error) {
    console.error('Ошибка отправки SMS:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}
