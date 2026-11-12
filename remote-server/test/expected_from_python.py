"""Writes the Python MCP server's outputs for test/cases.json, through the real MCP stdio path
(so input validation is included). Run with the plugin-mcp venv:
python expected_from_python.py <server.py> <cases.json> <out.json>"""
import asyncio, json, sys
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main(server, cases_path, out_path):
    cases = json.load(open(cases_path, encoding='utf-8'))
    out = []
    async with stdio_client(StdioServerParameters(command=sys.executable, args=[server])) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            for name, args in cases:
                res = await s.call_tool(name, args)
                out.append({'error': True} if res.isError else {'ok': json.loads(res.content[0].text)})
    json.dump(out, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)

asyncio.run(main(*sys.argv[1:4]))
