"""
What a live alert email looks like, as plain text and as html.

The html is dressed like the opium den pages (cream paper, black ink, the red accent, a
heading ending in a red dot), but kept deliberately plain for spam filters: one centered
column of tables with inline styles, system fonts, no images, nothing loaded from
anywhere, and only links to our own site. The plain text goes out alongside it, so the
two always say the same thing.
"""

from html import escape

# the den's light palette (--color-den-* in website/app/globals.css)
DEN_BG = "#efeee9"
DEN_INK = "#121212"
DEN_MUTED = "#5f5e58"
DEN_ACCENT = "#ff3d14"

# system fonts only, since mail apps mostly won't load web fonts anyway
SANS_FONTS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO_FONTS = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

CONTENT_WIDTH_PX = 560
KICKER = "Opium Den &middot; Live now"

ALERT_TEXT = """{body}

Join the room: {room_url}

--
You're getting this because you signed up for live alerts on tyler-schwenk.com.
Unsubscribe: {unsubscribe_url}"""

ALERT_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:{bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{bg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:{width}px;">
<tr><td style="padding-bottom:12px;font-family:{mono};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:{accent};">{kicker}</td></tr>
<tr><td style="padding-bottom:10px;border-bottom:1px solid {ink};font-family:{sans};font-size:32px;font-weight:800;line-height:1.1;letter-spacing:-1px;color:{ink};">{heading}</td></tr>
<tr><td style="padding:24px 0 20px;font-family:{sans};font-size:16px;line-height:1.55;color:{ink};">{body}</td></tr>
<tr><td style="padding-bottom:40px;font-family:{sans};font-size:16px;line-height:1.55;color:{ink};">Join the room <a href="{room_url}" style="color:{ink};font-weight:700;text-decoration:none;border-bottom:2px solid {accent};">here</a>.</td></tr>
<tr><td style="padding-top:12px;border-top:1px solid {muted};font-family:{mono};font-size:11px;line-height:1.6;color:{muted};">You're getting this because you signed up for live alerts on tyler-schwenk.com. <a href="{unsubscribe_url}" style="color:{muted};text-decoration:underline;">Unsubscribe</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def html_heading(subject: str) -> str:
    """
    The subject as the email's big heading, finished with the den's red dot like the
    site's page headings. Skips the dot when the subject already ends in punctuation.

    Args:
        subject: The alert's subject line.

    Returns:
        str: Escaped html.
    """
    heading = escape(subject)
    if not subject[-1:].isalnum():
        return heading
    return f'{heading}<span style="color:{DEN_ACCENT};">.</span>'


def alert_text(body: str, room_url: str, unsubscribe_url: str) -> str:
    """
    The plain text version of an alert.

    Args:
        body: What the dj wrote, line breaks kept.
        room_url: The live room.
        unsubscribe_url: This subscriber's unsubscribe link.

    Returns:
        str: The email's text.
    """
    return ALERT_TEXT.format(body=body, room_url=room_url, unsubscribe_url=unsubscribe_url)


def alert_html(subject: str, body: str, room_url: str, unsubscribe_url: str) -> str:
    """
    The html version of an alert. Everything the dj typed is escaped, and their line
    breaks become <br>s.

    Args:
        subject: The subject line, shown as the heading too.
        body: What the dj wrote.
        room_url: The live room.
        unsubscribe_url: This subscriber's unsubscribe link.

    Returns:
        str: A full html document.
    """
    return ALERT_HTML.format(
        subject=escape(subject),
        heading=html_heading(subject),
        body=escape(body).replace("\n", "<br>\n"),
        room_url=escape(room_url),
        unsubscribe_url=escape(unsubscribe_url),
        kicker=KICKER,
        bg=DEN_BG,
        ink=DEN_INK,
        muted=DEN_MUTED,
        accent=DEN_ACCENT,
        sans=SANS_FONTS,
        mono=MONO_FONTS,
        width=CONTENT_WIDTH_PX,
    )
