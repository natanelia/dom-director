"""Audit the actual Earth host in editing, interaction, and public layouts."""


def audit_earth(case, audit, axe_path):
    page = case.page
    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.goto(case.url)
    page.wait_for_function("document.querySelector('#studio')?.dataset.ready==='true' && document.querySelector('#studio').dataset.host==='earth'")
    page.emulate_media(reduced_motion='reduce')
    page.add_script_tag(path=str(axe_path))
    audit('earth-studio-ready')
    page.locator('#try-controls').focus()
    page.keyboard.press('Enter')
    assert not page.locator('#scene').evaluate('el=>el.inert')
    page.locator('button[data-earth-metric="energy"]').focus()
    page.keyboard.press('Enter')
    audit('earth-studio-controls')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    audit('earth-studio-controls-mobile')
    page.keyboard.press('Escape')
    assert page.locator('#try-controls').evaluate('el=>el===document.activeElement')

    page.set_viewport_size({'width': 1440, 'height': 1100})
    page.goto(case.url.removesuffix('studio.html'))
    page.wait_for_function("document.querySelector('#stage')?.dataset.runtime==='sdk' && !!document.querySelector('canvas.earth-globe')")
    page.add_script_tag(path=str(axe_path))
    audit('earth-public-ready')
    page.set_viewport_size({'width': 390, 'height': 844})
    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
    page.locator('canvas.earth-globe').focus()
    page.keyboard.press('ArrowRight')
    audit('earth-public-mobile')
