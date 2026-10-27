# geoforge promo kit

## GitHub About (one line)
Open-source GEO/AEO auditor, llms.txt compiler and MCP server. Optimize websites and online stores for ChatGPT Search, Google AI Overviews, Claude and Perplexity.

## Tagline options
- Stop dumping HTML into llms.txt. Ship the files AI search actually uses.
- The free GEO/AEO toolkit: audit, compile, deploy.
- Be the answer, not just a blue link.

## Show HN
Title: Show HN: geoforge - open-source GEO/AEO auditor and llms.txt compiler (CLI + MCP)

Body:
Most llms.txt generators convert dirty HTML into one giant file, and the commercial GEO tools cost $100-500 per month and only report problems. I built geoforge to do the missing part: audit a site and compile the files you actually deploy.

It scores a site 0-100 on 5 pillars, tells AI search bots (the ones that send traffic, like OAI-SearchBot and Claude-SearchBot) apart from training scrapers, checks question headings and BLUF answers, validates Product/Offer/BuyAction JSON-LD for e-commerce, and finds social profiles that are missing from sameAs. Then it writes llms.txt, a token-capped llms-full.txt, geo-schema.jsonld, robots.ai.txt and an audit report.

TypeScript, runs fully locally, no API keys, 30 offline tests. It is also a native MCP server, so Claude Code or Cursor can call it directly. Feedback on the heuristics is very welcome, especially from people running real stores.
https://github.com/uggukr-create/geoforge

## Reddit (r/SEO, r/ecommerce, r/ClaudeAI, r/LocalLLaMA)
Title: I built a free open-source tool that audits your site for AI search (ChatGPT, Claude, Perplexity) and generates llms.txt, JSON-LD and robots rules

Body:
Up to half of AI-answer searches end without a click, so being cited matters more than ranking. I could not find a free tool that does more than copy HTML into llms.txt, so I made one.

geoforge crawls your site locally, checks which AI bots you accidentally block, scores answer-engine readiness, and generates ready-to-deploy files (llms.txt, llms-full.txt with a token budget, geo-schema.jsonld, robots.ai.txt, a prioritized fix report). It also runs as an MCP server for Claude Code and Cursor. MIT license, no paid API. Repo: https://github.com/uggukr-create/geoforge
Tell me what checks you would add.

## X / Twitter thread
1/ AI search is eating clicks. Being cited by ChatGPT, Claude and Perplexity is the new SEO. I built geoforge, a free open-source GEO/AEO toolkit.
2/ Problem: many sites block the AI bots that send traffic (OAI-SearchBot, Claude-SearchBot, PerplexityBot) while trying to block training scrapers. geoforge separates the two and writes a correct robots.ai.txt.
3/ It audits question headings and BLUF answers, Product/Offer/BuyAction schema for stores, sameAs links to your socials, and gives a 0-100 readiness score.
4/ Then it compiles the files you deploy: llms.txt, llms-full.txt (token-capped), geo-schema.jsonld, robots.ai.txt, audit report.
5/ CLI + native MCP server for Claude Code, Claude Desktop and Cursor. TypeScript, MIT, no API keys. https://github.com/uggukr-create/geoforge

## LinkedIn
I just open-sourced geoforge, a GEO/AEO toolkit for the AI-search era. It audits how well your website or online store is prepared for ChatGPT Search, Google AI Overviews, Claude and Perplexity, and generates the files that fix it: llms.txt, a token-budgeted llms-full.txt, enriched JSON-LD, robots rules for AI bots and a prioritized report. It runs locally with no paid APIs and also works as an MCP server. If you run an e-commerce site, I would love your feedback: https://github.com/uggukr-create/geoforge

## Telegram (Russian)
Выложил в опенсорс geoforge: бесплатный инструмент для продвижения сайтов и интернет-магазинов в ИИ-выдаче (ChatGPT, Claude, Perplexity, Gemini).

Что делает:
- проверяет, не закрыт ли сайт от ИИ-ботов, которые приводят трафик (OAI-SearchBot, Claude-SearchBot, PerplexityBot);
- оценивает готовность сайта к ответам нейросетей: вопросительные заголовки, прямые ответы, разметка Product, Offer, FAQ, соцсети в sameAs;
- генерирует готовые файлы: llms.txt, llms-full.txt, geo-schema.jsonld, robots.ai.txt и отчёт с планом исправлений.

Работает локально, без платных API, есть режим MCP-сервера для Claude Code. Код: https://github.com/uggukr-create/geoforge

## Telegram (Ukrainian)
Виклав в опенсорс geoforge: безкоштовний інструмент для просування сайтів та інтернет-магазинів у відповідях ШІ (ChatGPT, Claude, Perplexity, Gemini). Перевіряє доступ ШІ-ботів, оцінює готовність сайту до відповідей нейромереж і генерує готові файли: llms.txt, llms-full.txt, geo-schema.jsonld, robots.ai.txt та звіт із планом виправлень. Працює локально, без платних API, є режим MCP-сервера. Код: https://github.com/uggukr-create/geoforge

## Claude for Open Source application
Project: geoforge (https://github.com/uggukr-create/geoforge)
What it is: an MIT-licensed, local-first GEO/AEO auditor, llms.txt compiler and native MCP server written in strict TypeScript.
Ecosystem impact: it helps website owners make their content discoverable and correctly cited by AI assistants, including Anthropic's own Claude-SearchBot and Claude-User, by fixing robots rules, structured data and llms.txt. It separates search/citation bots from training scrapers so owners can choose training access deliberately.
Engineering quality: 30 offline unit and integration tests (Vitest), CI on Node 20 and 22, a CLAUDE.md for agent-assisted development, CONTRIBUTING guide, and an MCP server exposing 4 tools over stdio.
How the grant would be used: extending the heuristics against real-world stores, adding multilingual BLUF detection, and maintaining the project.

## Hashtags
#GEO #AEO #llmstxt #MCP #SEO #AISearch #ecommerce #opensource
