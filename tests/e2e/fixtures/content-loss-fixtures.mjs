import JSZip from 'jszip';
import { generatePptx, generateXlsx } from './fixture-generator.mjs';

const relNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const relsNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
const drawingNamespace = 'http://schemas.openxmlformats.org/drawingml/2006';

export async function generateSmartArtPptx() {
  const zip = await JSZip.loadAsync(
    await generatePptx({ slides: [{ title: 'Flow diagram' }, { title: 'Next slide' }] }),
  );
  const slidePath = 'ppt/slides/slide1.xml';
  const slide = await zip.file(slidePath).async('string');
  const graphic = `<p:graphicFrame>
    <p:xfrm><a:off x="1000000" y="1700000"/><a:ext cx="7000000" cy="2500000"/></p:xfrm>
    <a:graphic><a:graphicData uri="${drawingNamespace}/diagram">
      <dgm:relIds xmlns:dgm="${drawingNamespace}/diagram" xmlns:r="${relNamespace}" r:dm="rId7"/>
    </a:graphicData></a:graphic>
  </p:graphicFrame>`;
  zip.file(slidePath, slide.replace('</p:spTree>', graphic + '</p:spTree>'));
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships xmlns="${relsNamespace}">
      <Relationship Id="rId7" Type="${relNamespace}/diagramData" Target="../diagrams/data.xml"/>
    </Relationships>`,
  );
  zip.file(
    'ppt/diagrams/data.xml',
    `<dgm:dataModel xmlns:dgm="${drawingNamespace}/diagram" xmlns:a="${drawingNamespace}/main">
      <dgm:ptLst>
        <dgm:pt modelId="root" type="doc"/>
        <dgm:pt modelId="first"><dgm:t><a:p>
          <a:r><a:t>Collect</a:t></a:r><a:br/><a:r><a:t>input</a:t></a:r>
        </a:p></dgm:t></dgm:pt>
        <dgm:pt modelId="second" type="node"><dgm:t><a:p><a:r><a:t>Review output</a:t></a:r></a:p></dgm:t></dgm:pt>
        <dgm:pt modelId="layout" type="pres"><dgm:t><a:p><a:r><a:t>Layout placeholder</a:t></a:r></a:p></dgm:t></dgm:pt>
      </dgm:ptLst>
    </dgm:dataModel>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function generateListHeaderTableOdp(imageColumn) {
  const zip = new JSZip();
  const ns = 'urn:oasis:names:tc:opendocument:xmlns:';
  const tableRow = (...cells) =>
    `<table:table-row>${cells
      .map(
        (cell) => `<table:table-cell><text:list><text:list-header><text:p>${cell}</text:p>
          </text:list-header></text:list></table:table-cell>`,
      )
      .join('')}</table:table-row>`;
  if (imageColumn) {
    zip.file(
      'Pictures/diagram.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40"/></svg>',
    );
  }
  const sideTable = `<draw:frame svg:x="2cm" svg:y="10.25cm" svg:width="4cm" svg:height="0.1cm">
    <table:table>${tableRow('Side table')}</table:table>
  </draw:frame>`;
  const centerNote = `<draw:frame svg:x="10cm" svg:y="10.4cm" svg:width="4cm" svg:height="0.15cm">
    <draw:text-box><text:p>Center note.</text:p></draw:text-box>
  </draw:frame>`;
  const rightHeading = `<draw:frame svg:x="19cm" svg:y="10.09cm" svg:width="4cm" svg:height="0.13cm">
    <draw:text-box><text:h text:outline-level="3">Right heading</text:h></draw:text-box>
  </draw:frame>`;
  zip.file(
    'content.xml',
    `<office:document-content xmlns:office="${ns}office:1.0" xmlns:draw="${ns}drawing:1.0"
      xmlns:svg="${ns}svg-compatible:1.0" xmlns:table="${ns}table:1.0" xmlns:text="${ns}text:1.0"
      xmlns:xlink="http://www.w3.org/1999/xlink">
      <office:body><office:presentation><draw:page>
        <draw:frame svg:x="2cm" svg:y="5cm">
          <table:table>
            ${tableRow('Format', 'Extension')}
            ${tableRow('Text', 'ODT')}
            ${tableRow('Drawing', 'ODG')}
          </table:table>
        </draw:frame>
      </draw:page><draw:page>
        <draw:frame svg:x="2cm" svg:y="1cm" svg:width="16cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="2">Report</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="10cm" svg:width="16cm" svg:height="2cm">
          <table:table>${tableRow('Items', 'Count')}${tableRow('Widgets', '8')}</table:table>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="8cm" svg:width="16cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="3">Section</text:h></draw:text-box>
        </draw:frame>
        ${imageColumn === 'right' ? '<draw:frame svg:x="19cm" svg:y="8.4cm" svg:width="5cm" svg:height="1cm"><draw:text-box><text:h text:outline-level="3">Right section</text:h></draw:text-box></draw:frame>' : ''}
        ${imageColumn ? `<draw:frame svg:x="${imageColumn === 'right' ? '19cm' : '2cm'}" svg:y="9cm" svg:width="5cm" svg:height="2cm"><draw:image xlink:href="Pictures/diagram.svg"/></draw:frame>` : ''}
        <draw:frame svg:x="2cm" svg:y="12cm" svg:width="16cm" svg:height="1cm">
          <draw:text-box><text:p>Count excludes spares.</text:p></draw:text-box>
        </draw:frame>
      </draw:page><draw:page>
        <draw:frame svg:x="2cm" svg:y="3.15cm" svg:width="10cm" svg:height="1cm">
          <table:table>${tableRow('Type', 'Code')}${tableRow('One', '1')}</table:table>
        </draw:frame>
        <draw:frame svg:x="9cm" svg:y="3cm" svg:width="10cm" svg:height="0.3cm">
          <draw:text-box><text:h text:outline-level="2">Nearby heading</text:h></draw:text-box>
        </draw:frame>
      </draw:page>
      ${
        imageColumn
          ? `<draw:page>
        <draw:frame svg:x="2cm" svg:y="1cm" svg:width="16cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="2">Figures</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="8cm" svg:width="5cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="3">Diagram</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="9cm" svg:width="5cm" svg:height="1.4cm">
          <draw:image xlink:href="Pictures/diagram.svg"/>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="10.6cm" svg:width="5cm" svg:height="1cm">
          <draw:text-box><text:p>Diagram caption.</text:p></draw:text-box>
        </draw:frame>
      </draw:page>`
          : ''
      }
      <draw:page>
        <draw:frame svg:x="2cm" svg:y="1cm" svg:width="16cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="2">Overview</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="4cm" svg:y="8cm" svg:width="12cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="3">Inset heading</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="8.25cm" svg:width="16cm" svg:height="2cm">
          <draw:text-box><text:p>Body in the same column.</text:p></draw:text-box>
        </draw:frame>
      </draw:page>
      <draw:page>
        <draw:frame svg:x="2cm" svg:y="1cm" svg:width="16cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="2">Columns</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="8.25cm" svg:width="10cm" svg:height="2cm">
          <draw:text-box><text:p>Left column.</text:p></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="8.4cm" svg:y="8cm" svg:width="10cm" svg:height="2cm">
          <draw:text-box><text:p>Right column.</text:p></draw:text-box>
        </draw:frame>
      </draw:page>
      <draw:page>
        <draw:frame svg:x="2cm" svg:y="2cm" svg:width="6cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="3">Left section</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="14cm" svg:y="2cm" svg:width="10cm" svg:height="1cm">
          <draw:text-box><text:h text:outline-level="3">Wider right section</text:h></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="2cm" svg:y="3.5cm" svg:width="6cm" svg:height="2cm">
          <draw:text-box><text:p>Left section body.</text:p></draw:text-box>
        </draw:frame>
        <draw:frame svg:x="14cm" svg:y="3.5cm" svg:width="10cm" svg:height="2cm">
          <draw:text-box><text:p>Right section body.</text:p></draw:text-box>
        </draw:frame>
      </draw:page>
      <draw:page>${sideTable}${centerNote}${rightHeading}</draw:page>
      <draw:page>${rightHeading}${centerNote}${sideTable}</draw:page>
      </office:presentation></office:body>
    </office:document-content>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function generateWorksheetHyperlinksXlsx() {
  const zip = await JSZip.loadAsync(
    await generateXlsx({
      headers: ['Web', 'Workbook', 'Range', 'Other'],
      rows: [
        ['Read [details] | here', 'Other sheet', 'First', 'Keep the label'],
        ['Not linked', '', 'Second', ''],
      ],
    }),
  );
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheet = await zip.file(sheetPath).async('string');
  const hyperlinks = `<hyperlinks xmlns:r="${relNamespace}">
    <hyperlink ref="A2" r:id="rId7" location="part-1"/>
    <hyperlink ref="B2" location="'Source Data'!B3"/>
    <hyperlink ref="C2:C3" r:id="rId8"/>
    <hyperlink ref="D2" r:id="missing"/>
    <hyperlink ref="D3" r:id="rId9" display="Email support"/>
    <hyperlink ref="B4" r:id="rId9" display="Missing row"/>
  </hyperlinks>`;
  zip.file(
    sheetPath,
    sheet
      .replace(' r="A2"', '')
      .replace(/<c r="D3"[^>]*>.*?<\/c>/s, '')
      .replace('</worksheet>', hyperlinks + '</worksheet>'),
  );
  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<Relationships xmlns="${relsNamespace}">
      <Relationship Id="rId7" Type="${relNamespace}/hyperlink" TargetMode="External"
        Target="https://example.org/a(b)?x=1&amp;y=2"/>
      <Relationship Id="rId8" Type="${relNamespace}/hyperlink" TargetMode="External"
        Target="https://example.org/range"/>
      <Relationship Id="rId9" Type="${relNamespace}/hyperlink" TargetMode="External"
        Target="mailto:support@example.org"/>
    </Relationships>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}
