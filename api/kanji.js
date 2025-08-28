const fetch = require('node-fetch');

export default async (req, res) => {
  // Lấy từ khóa (keyword) từ query string
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'Keyword is required.' });
  }

  try {
    // Gọi API của Jisho từ phía server
    const jishoUrl = `https://beta.jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`;
    const response = await fetch(jishoUrl);
    const data = await response.json();
    
    // Trả về dữ liệu từ Jisho cho client
    res.status(200).json(data);

  } catch (error) {
    console.error('Error fetching data from Jisho:', error);
    res.status(500).json({ error: 'Failed to fetch data from Jisho API.' });
  }
};