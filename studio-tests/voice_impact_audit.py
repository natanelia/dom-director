"""Voice impact audit states; keep every enabled axe rule and incomplete finding."""
from voice_impact_test import load_voice_impact_fixture


def audit_voice_impact(case, audit):
    page = case.page
    page.set_viewport_size({'width': 1440, 'height': 1000})
    load_voice_impact_fixture(case, 'pages')
    case.choose('voice')
    # Inspector disclosure choices survive native project replacement. A previous
    # audit may already have opened Available takes; do not toggle it closed.
    takes = page.locator('details[data-section="Available takes"]')
    if not takes.evaluate('el=>el.open'):
        takes.locator('summary').click()
    trigger = takes.locator('.clip-list-item').nth(1)
    trigger.focus()
    page.keyboard.press('Enter')
    page.locator('#dialog-actions').get_by_role('button', name='Fit scene to voice', exact=True).click()
    page.locator('#voice-impact-summary').wait_for()
    assert page.locator('#dialog-actions').get_by_role('button', name='Cancel', exact=True).evaluate('el=>el===document.activeElement')
    audit('voice-impact-summary')
    for kind in ['captions', 'camera', 'cursor', 'voice']:
        page.locator('details[data-impact-kind="' + kind + '"] > summary').click()
    cc = page.locator('details[data-impact-kind="captions"]')
    assert cc.locator('[data-impact-items] > li').count() == 20
    audit('voice-impact-expanded')
    cc.locator('[data-impact-next]').focus()
    page.keyboard.press('Enter')
    assert cc.locator('[data-impact-items] > li').count() == 5
    assert cc.evaluate('el=>el.contains(document.activeElement)')
    audit('voice-impact-last-page')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    assert not page.locator('#dialog').evaluate('el=>el.scrollWidth > el.clientWidth+1')
    audit('voice-impact-mobile')
    page.keyboard.press('Escape')
    page.wait_for_function("!document.querySelector('#dialog').open")
    page.wait_for_function("document.activeElement?.matches('details[data-section=\"Available takes\"] .clip-list-item')")
    assert trigger.evaluate('el=>el===document.activeElement')

    # The same error used by a stale asynchronous proposal remains inside the
    # native modal so keyboard/screen-reader users can encounter it.
    page.set_viewport_size({'width': 1440, 'height': 1000})
    case.choose('captions')
    case.edit('#caption-size', '42')
    case.choose('voice')
    takes = page.locator('details[data-section="Available takes"]')
    if not takes.evaluate('el=>el.open'):
        takes.locator('summary').click()
    takes.locator('.clip-list-item').nth(1).click()
    page.locator('#dialog-actions').get_by_role('button', name='Fit scene to voice', exact=True).click()
    page.locator('#voice-impact-summary').wait_for()
    page.locator('#undo').evaluate('el=>el.click()')
    page.locator('#dialog-actions').get_by_role('button', name='Use take and retime', exact=True).click()
    assert page.locator('#voice-impact-error').is_visible()
    assert page.locator('#voice-impact-error').get_attribute('role') == 'alert'
    audit('voice-impact-stale-review')
    page.keyboard.press('Escape')
    page.wait_for_function("!document.querySelector('#dialog').open")
