const { GoogleGenerativeAI } = require("@google/generative-ai");
const ai = new GoogleGenerativeAI(require('dotenv').config().parsed.GEMINI_API_KEY);
(async () => {
    // There is no listModels in the JS SDK? Let's just fetch it using fetch.
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    console.log(data.models.map(m => m.name).filter(n => n.includes('flash')));
})();
