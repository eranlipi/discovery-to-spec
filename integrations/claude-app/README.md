# d2s in the Claude app

`d2s-discovery` is a skill for the Claude app (claude.ai and Claude desktop). It brings the d2s method to designers and product managers who work in chat, not in a terminal. With it, Claude helps them:

- frame the problem;
- turn raw interview notes into insights with evidence;
- lay out genuinely different directions;
- prepare the decision;
- write the spec.

Every stage ends with a short document that has the team's exact headings. In the d2s plugin in Figma, or in the sandbox on the website, **Paste from Claude** fills the stage's fields from it. The gate then checks it as usual.

It follows the same rules as the d2s agent skills: never invent research, quotes, numbers or Figma links, and never fill in "Approved by".

## Install (once)

1. Download `d2s-discovery-skill-<version>.zip` from the [latest release](https://github.com/eranlipi/discovery-to-spec/releases). Keep it zipped.
2. In Claude, open **Customize → Skills** (claude.ai/customize/skills). Choose **+**, then **Create skill → Upload a skill**, pick the zip, and turn the skill on.
   - Skills need **code execution** turned on. In settings it may be called "Create and edit files" or "Code execution and file creation".
   - Custom skills work on paid plans. On Team and Enterprise, an owner may need to allow them.
   - These menu names may differ slightly from version to version.
3. **No skills on your plan?** Create a **Project** instead and paste `project-instructions.md`, from the same release, into the project's instructions. The same text works as instructions for a project in other chat assistants too.

## Use

Just talk to Claude. For example:

- "Let's frame a problem: our manager wants an Apple Pay button on mobile checkout."
- Paste interview notes, support tickets or data, then ask: "Help me understand what comes out of this."
- "Here are our insights. Which directions do we have?"

Claude asks a few questions and then gives the document. In Figma, open the stage in the d2s plugin, choose **Paste from Claude**, and paste it.

## Build

```bash
npm run claude-skill    # writes integrations/claude-app/dist/
```

The build copies `d2s-discovery/SKILL.md` and adds the stage templates, in English and Hebrew, under `assets/`. It also writes `project-instructions.md`. The release workflow zips the skill folder.

`test/claude-app.test.js` checks the package rules and that every `##` heading in the templates appears in `SKILL.md`. That way, documents written in Claude always fill the forms.

---

## בעברית: d2s בתוך Claude

**מה זה:** skill ל-Claude שעוזר לחשוב לפני שבונים. הוא שואל את השאלות הנכונות, הופך הערות גולמיות מראיונות לתובנות עם ראיות, ופורס כיוונים שונים באמת. בסוף כל שלב הוא נותן מסמך עם הכותרות של הצוות.

**התקנה, פעם אחת:**
1. מורידים את `d2s-discovery-skill-<version>.zip` מ[דף הגרסאות](https://github.com/eranlipi/discovery-to-spec/releases), בלי לפתוח אותו.
2. ב-Claude: **Customize → Skills**, ואז **+**, **Create skill** ו-**Upload a skill**. בוחרים את הקובץ ומדליקים את ה-skill.
   - צריך שבהגדרות תהיה דלוקה האפשרות ליצור ולערוך קבצים (code execution).
3. **אין skills בתוכנית?** יוצרים Project ומדביקים את `project-instructions.md` בהוראות של הפרויקט.

**שימוש:**
- **מדברים רגיל:** "בוא נמסגר בעיה…", או מדביקים הערות מראיונות ושואלים "מה יוצא מזה?".
- **בסוף:** בתוסף של d2s ב-Figma בוחרים **הדבקה מ-Claude** ומדביקים, והשדות מתמלאים לבד.
- **Claude לא ממציא:** לא מחקר ולא ציטוטים. הוא גם לא ממלא את "מי אישר", כי רק אנשים מאשרים.
