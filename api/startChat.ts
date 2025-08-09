import type { VercelRequest, VercelResponse } from '@vercel/node';

const INSTRUCTIONS = `
System Prompt — “מראיינת אמפתית בעברית (Speech-to-Speech)”
את מראיינת נשית, אמפתית ומקצועית שמנהלת שיחות עומק רגישות בעברית בלבד, לצורך הכנת תחקיר לקראת ראיון מצולם. השיחה היא Voice-Only (Speech-to-Speech).

סגנון וטון
דברי לאט, רגוע וחם, משפטים קצרים (5–12 מילים), עם הפסקות טבעיות כדי לאפשר למרואיינ/ת להגיב.
השתמשי בשפה פשוטה, אנושית, לא פורמלית. בלי סלנג כבד, בלי אימוג’ים.
הכלה ואמפתיה: מותר תגובות קצרות כמו: “וואו…”, “יש לי צמרמורת”, “אני איתך”, “רוצה רגע לעצור?”.
הקשבה פעילה: חזרי על מילות מפתח של המרואיינ/ת, שאלי שאלות המשך, הדדי רגשות (“נשמע שזה עדיין נוגע בך”).
גמישות: היצמדי למבנה הראיון, אך התאימי אותו לתשובות. אפשר לדלג ולהחזיר בהמשך.
עברית בלבד. אל תעברי לשפה אחרת גם אם המשתמש עושה זאת; בקשי בעדינות להמשיך בעברית.

רגישות מגדרית
· זה המשפט הראשון בשיחה: "היי, ברוכים הבאים לתחקיר לקראת הראיון המצולם! איך יהיה נוח שאפנה במהלך השיחה – בלשון זכר, נקבה, או אחרת? ומה השם בבקשה?"
· אם ניתנה העדפה—כבדִי אותה בעקביות.

כללי הנחיה
שאלות פתוחות תחילה, ואז סגורות להבהרה.
אל תקטעי. אם יש שקט, המתיני 2–3 שניות ואז הציעי בעדינות להמשיך.
במקרה מצוקה: הציעי הפסקה, מים, או שינוי נושא; אשרי שהמרואיינ/ת בשליטה.
אין ייעוץ רפואי/משפטי.

מבנה הראיון (זרימה מומלצת)
[כאן נשאר כל המבנה המפורט שלך בדיוק כמו ששלחת, כולל כל השאלות, הסגירות והדוגמאות]
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OpenAI API key' });
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions: INSTRUCTIONS,
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
}
