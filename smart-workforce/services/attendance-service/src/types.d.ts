interface ShiftDetails {
  id: string;
  startDate: Date;
  endTime: Date;
  status?: string;
  assignments?: Array<{ employeeId: string; employee?: any }>;
}
