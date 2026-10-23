/** One person in the mock company directory (shared by Settings and Roster). */
export interface DirectoryEmployee {
  id: string
  name: string
  jobTitle: string
  department: string
  /** Home branch (Settings → Branch), if assigned. */
  branchId: string | null
}

const person = (
  id: string,
  name: string,
  department: string,
  jobTitle: string,
  branchId: string | null = null,
): DirectoryEmployee => ({ id, name, jobTitle, department, branchId })

export const DIRECTORY: readonly DirectoryEmployee[] = [
  // Managers (also the Branch "Manager" options).
  person('em_shelley', 'Shelley Kannes', 'Human Resource Management', 'HR Manager', 'br_lhr_ho'),
  person('em_ayesha', 'Ayesha Malik', 'Operations', 'Operations Manager', 'br_lhr_ho'),
  person('em_omar', 'Omar Siddiqui', 'Operations', 'Branch Manager', 'br_isb'),
  person('em_sara', 'Sara Khan', 'Sales', 'Regional Manager', 'br_khi'),
  person('em_bilal', 'Bilal Ahmed', 'Software', 'Engineering Manager', 'br_lhr_jt'),
  person('em_hina', 'Hina Raza', 'Finance', 'Finance Manager', 'br_lhr_ho'),
  person('em_daniel', 'Daniel Brooks', 'Sales', 'Country Manager', 'br_dxb'),
  // Staff, the first ten as listed in the Roster enrollment design.
  person('em_hamda', 'Dr Hamda Shafeeq', 'Physiotherapy', 'Head of Physiotherapy', 'br_lhr_ho'),
  person('em_huzaifa', 'Dr Huzaifa Jamal', 'Surgery', 'General Surgeon', 'br_lhr_ho'),
  person('em_kamal', 'Dr Kamal', 'Surgery', 'Head of Surgery', 'br_lhr_ho'),
  person('em_saad', 'Saad Hadier', 'Mobile App', 'Project Manager App', 'br_lhr_jt'),
  person('em_haroon', 'Haroon Jalani', 'Software', 'Software Developer', 'br_lhr_jt'),
  person('em_rehan', 'Rehan Ahmad', 'Software', 'Software Developer', 'br_lhr_jt'),
  person('em_kaleem', 'Kaleem Murtaza', 'Human Resource Management', 'HR Manager', 'br_isb'),
  person('em_jack', 'Jack Roy', 'Marketing', 'GM Marketing', 'br_dxb'),
  person('em_areeba', 'Areeba Hameed', 'Marketing', 'Manager Marketing', 'br_khi'),
  person('em_faisal', 'Faisal Khan', 'Marketing', 'Manager Marketing', 'br_khi'),
  person('em_sana', 'Dr Sana Iqbal', 'Physiotherapy', 'Physiotherapist', 'br_isb'),
  person('em_usman', 'Dr Usman Tariq', 'Surgery', 'Orthopaedic Surgeon', 'br_isb'),
  person('em_mahnoor', 'Mahnoor Ali', 'Software', 'QA Engineer', 'br_lhr_jt'),
  person('em_zainab', 'Zainab Noor', 'Mobile App', 'iOS Developer', 'br_lhr_jt'),
  person('em_hamza', 'Hamza Sheikh', 'Mobile App', 'Android Developer', 'br_rwp'),
  person('em_omer', 'Omer Farooq', 'Finance', 'Accountant', 'br_lhr_ho'),
  person('em_sadia', 'Sadia Rehman', 'Human Resource Management', 'HR Executive', 'br_lhr_ho'),
  person('em_daniyal', 'Daniyal Qureshi', 'Marketing', 'Marketing Executive', 'br_khi'),
  person('em_maryam', 'Maryam Javed', 'Software', 'UI/UX Designer', 'br_lhr_jt'),
  person('em_talha', 'Talha Aziz', 'Software', 'Software Developer', 'br_rwp'),
  person('em_nida', 'Nida Hassan', 'Physiotherapy', 'Physiotherapist', 'br_isb'),
  person('em_imran', 'Imran Butt', 'Surgery', 'Anaesthetist', 'br_lhr_ho'),
  person('em_fatima', 'Fatima Zahra', 'Physiotherapy', 'Physiotherapist', 'br_lhr_ho'),
  person('em_asad', 'Asad Mehmood', 'Software', 'DevOps Engineer', 'br_rwp'),
  person('em_rabia', 'Rabia Anwar', 'Marketing', 'Content Writer', 'br_khi'),
  person('em_kashif', 'Kashif Raza', 'Operations', 'Office Administrator', 'br_isb'),
  person('em_laiba', 'Laiba Shah', 'Human Resource Management', 'Recruiter', 'br_lhr_ho'),
]

export function findEmployee(id: string): DirectoryEmployee | undefined {
  return DIRECTORY.find((employee) => employee.id === id)
}
