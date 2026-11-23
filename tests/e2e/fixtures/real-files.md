# Manual-report originals

Tier 6 runs the originals in the fixture archive with no network access. Each case verifies the original byte length and SHA-256 before converting and checks selected Markdown, not full output fidelity. The archive contains unmodified inputs and this notice. These works retain their own licenses; the project's license is not applied to them.

The [manifest](real-files.json) lists each source URL and expected bytes. The five entries marked `external` are not redistributed: the LibreOffice presentation is 12 MB; the three third-party documents from Apache POI have no verified per-file redistribution permission; and the arXiv copy is not vendored because its redistribution terms were not verified. The test gate still runs generated fixtures for those formats offline, including the SmartArt and editable-table regressions.

To run all 17 original-file cases, save the five external documents from their sources under the manifest names in a local directory. Then run:

```sh
npm run compile
MARKDOWN_THEM_ORIGINALS=/path/to/originals node tests/e2e/run-e2e.mjs --tier=6
```

The TIFF-like appearance of the amendment PDF does not make this an OCR test: its original contains a text layer. PDF figure extraction, the CommonMark whitespace issue, and the separately handled legacy .doc/.xls formats are not asserted here. The manual report did not have a genuine XLM or .text sample.

## Attribution for the bundled originals

| Files                                                                 | Source and terms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bill-of-rights-handout.pdf`, `19th-amendment-scan.pdf`               | U.S. National Archives and Records Administration; U.S. government works, [public-domain notice](https://www.archives.gov/global-pages/privacy.html#copyright).                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `html4-tables.html`, `html4-forms.htm`                                | [Tables](https://www.w3.org/TR/html401/struct/tables.html) and [Forms](https://www.w3.org/TR/html401/interact/forms.html), from [HTML 4.01 Specification](https://www.w3.org/TR/html401/cover.html), W3C Recommendation, 24 December 1999. Copyright © 1997–1999 World Wide Web Consortium (Massachusetts Institute of Technology, Institut National de Recherche en Informatique et en Automatique, Keio University). All Rights Reserved. [W3C Document License](https://www.w3.org/Consortium/Legal/copyright-documents-19990405). The Forms filename uses the .htm alias; the bytes are unchanged. |
| `casualty-tables.xlsx`, `prison-dec-2019.ods`, `universal-credit.rtf` | UK Ministry of Defence, Ministry of Justice, and Social Security Advisory Committee / Department for Work and Pensions, respectively. Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).                                                                                                                                                                                                                                                                                                |
| `libreoffice-flyer.odt`                                               | Cor Nouws, via [The Document Foundation](https://wiki.documentfoundation.org/File:LibreOffice_FlyerFolded_3.0_UK.odt), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).                                                                                                                                                                                                                                                                                                                                                                                                                |
| `commonmark-spec.md`                                                  | John MacFarlane, CommonMark Spec 0.31.2, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The Markdown filename differs from the source .txt; the bytes are unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `jekyll-post.markdown`, `docusaurus-intro.mdx`                        | Jekyll and Docusaurus, MIT license below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `rfc9110.txt`                                                         | IETF Trust and document authors, 2022; [IETF Trust Legal Provisions](https://trustee.ietf.org/documents/trust-legal-provisions/tlp-5/). Original notices retained.                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### MIT license

Copyright (c) 2008-present Tom Preston-Werner and Jekyll contributors
(for `jekyll-post.markdown`)

Copyright (c) Facebook, Inc. and its affiliates.
(for `docusaurus-intro.mdx`)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
