import { format, subMonths } from 'date-fns'

import { downloadText, toCsv } from '../../utils/csv'

// "Sample Import": the CSV layouts the API's imports read (`POST …/import` with `{fileId}` of the
// uploaded file). The first line names the columns; months are `yyyy-MM`, dates `yyyy-MM-dd`.

export type ImportKind = 'opening-balance' | 'employee-account' | 'salary-revision'

const sampleMonth = () => format(subMonths(new Date(), 1), 'yyyy-MM')

const TEMPLATES: Record<
  ImportKind,
  { file: string; header: string[]; sample: (code: string) => (string | number)[] }
> = {
  'opening-balance': {
    file: 'opening-balance-sample.csv',
    header: ['Employee Code', 'Pay Item', 'Month', 'Amount', 'Taxable', 'Description'],
    sample: (code) => [
      code,
      'Travel Allowance',
      sampleMonth(),
      5000,
      'No',
      'Carried from the old system',
    ],
  },
  'employee-account': {
    file: 'employee-account-sample.csv',
    header: ['Employee Code', 'Account', 'Month', 'Credit', 'Debit', 'Description'],
    sample: (code) => [code, 'Provident Fund', sampleMonth(), 12500, 0, 'Opening provident fund'],
  },
  'salary-revision': {
    file: 'salary-revision-sample.csv',
    header: ['Employee Code', 'Effective Date', 'Salary'],
    sample: (code) => [code, `${sampleMonth()}-01`, 150000],
  },
}

/** Downloads the import's CSV layout with one sample line. */
export function downloadImportTemplate(kind: ImportKind, sampleCode: string) {
  const template = TEMPLATES[kind]
  downloadText(toCsv(template.header, [template.sample(sampleCode)]), template.file)
}
