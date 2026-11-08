# The d2s assistant: Claude, ChatGPT and Gemini

The d2s assistant brings the d2s method to designers and product managers who work in a chat assistant, not in a terminal. In an ordinary chat, it helps them:

- frame the problem;
- turn raw interview notes into insights with evidence;
- lay out genuinely different directions;
- prepare the decision;
- write the spec.

Every stage ends with a short document that has the team's exact headings. In the d2s plugin in Figma, or in the sandbox on the website, **Paste from AI** fills the stage's fields from it. The gate then checks it as usual.

It follows the same rules as the d2s agent skills: never invent research, quotes, numbers or Figma links, and never fill in "Approved by".

The method lives in one file, [`d2s-discovery/SKILL.md`](d2s-discovery/SKILL.md). Two things are built from it:

- **The skill** (`d2s-discovery-skill-<version>.zip`), for Claude. It includes the full stage templates.
- **The instructions** (`d2s-assistant-instructions.md`), the same method as plain text, for any assistant that takes custom instructions. The [website](https://discoverytospec.com/#assistant) has a copy button for it.

Both are attached to each [release](https://github.com/eranlipi/discovery-to-spec/releases).

## Set up (once)

These menu names may differ slightly from version to version.

### Claude

1. Download `d2s-discovery-skill-<version>.zip` from the latest release. Keep it zipped.
2. In Claude, open **Customize → Skills** (claude.ai/customize/skills). Choose **+**, then **Create skill → Upload a skill**, pick the zip, and turn the skill on.
   - Skills need **code execution** turned on. In settings it may be called "Create and edit files" or "Code execution and file creation".
   - Custom skills work on paid plans. On Team and Enterprise, an owner may need to allow them.
3. **No skills on your plan?** Create a **Project** and paste the instructions into the project's instructions.

### ChatGPT

1. Copy the instructions (the copy button on the website, or `d2s-assistant-instructions.md`).
2. Click **New project** in the sidebar and name it, for example "d2s discovery".
3. Open the project's **•••** menu, choose **Project settings**, paste the instructions and save. Check that all of the text was saved.
4. Start every chat about the feature inside the project.

Projects work on every plan. Custom GPTs can no longer be created on personal accounts. On Business and Enterprise, you can create a **Skill** with the same instructions instead (Plugins → Skills → Create).

### Gemini

1. Open **Skills** from the sidebar, then **Create → Create manually**.
2. Name it `d2s-discovery`. Paste the skill's description (the `description:` line of `SKILL.md`, or the copy button on the website) and the instructions. Click **Create**.
3. In any chat, type `/` and choose the skill.

Gemini skills are free on personal Google accounts. Gems are being retired, so use a skill.

## Use

Just talk. For example:

- "Let's frame a problem: our manager wants an Apple Pay button on mobile checkout."
- Paste interview notes, support tickets or data, then ask: "Help me understand what comes out of this."
- "Here are our insights. Which directions do we have?"

The assistant asks a few questions and then gives the document in a code block. Copy it, open the stage in the d2s plugin in Figma (or in the website sandbox), choose **Paste from AI**, and paste it.

## Build

```bash
npm run claude-skill    # writes integrations/claude-app/dist/
```

The build copies `d2s-discovery/SKILL.md` and adds the stage templates, in English and Hebrew, under `assets/`. It also writes `assistant-instructions.md`: the same text without the template pointers, kept under 8,000 characters. The release workflow zips the skill folder and attaches the instructions. The website embeds the same instructions and description when it is built.

`test/claude-app.test.js` checks the package rules and that every `##` heading in the templates appears in `SKILL.md`. That way, documents written in any of the assistants always fill the forms.

---

## בעברית: העוזר של d2s ב-Claude, ב-ChatGPT וב-Gemini

**מה זה:** עוזר שעוזר לחשוב לפני שבונים. הוא שואל את השאלות הנכונות, הופך הערות גולמיות מראיונות לתובנות עם ראיות, ופורס כיוונים שונים באמת. בסוף כל שלב הוא נותן מסמך עם הכותרות של הצוות.

**התקנה, פעם אחת** (באתר יש את השלבים וכפתור העתקה לכל אחד):
- **Claude:** מורידים את `d2s-discovery-skill-<version>.zip` מ[דף הגרסאות](https://github.com/eranlipi/discovery-to-spec/releases), בלי לפתוח אותו. ב-Claude: **Customize → Skills**, ואז **+**, **Create skill** ו-**Upload a skill**. צריך שבהגדרות תהיה דלוקה האפשרות ליצור ולערוך קבצים (code execution). אין skills בתוכנית? יוצרים Project ומדביקים את ההנחיות בהוראות שלו.
- **ChatGPT:** לוחצים על **New project** בסרגל הצד, פותחים את **•••** ← **Project settings** ומדביקים את ההנחיות. ב-Business וב-Enterprise אפשר גם Skill.
- **Gemini:** בסרגל הצד **Skills** ← **Create** ← **Create manually**. השם `d2s-discovery`, ומדביקים את התיאור ואת ההנחיות. בצ׳אט מקלידים `/` ובוחרים אותו.

**שימוש:**
- **מדברים רגיל:** "בוא נמסגר בעיה…", או מדביקים הערות מראיונות ושואלים "מה יוצא מזה?".
- **בסוף:** מעתיקים את המסמך, ובתוסף של d2s ב-Figma (או באתר) בוחרים **הדבקה מ-AI** ומדביקים. השדות מתמלאים לבד.
- **העוזר לא ממציא:** לא מחקר ולא ציטוטים. הוא גם לא ממלא את "מי אישר", כי רק אנשים מאשרים.
