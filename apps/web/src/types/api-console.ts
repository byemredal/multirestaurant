export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiFieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'password' | 'select' | 'json';
  defaultValue?: string;
};

export type ApiActionConfig = {
  id: string;
  method: HttpMethod;
  path: string;
  pathParams?: ApiFieldConfig[];
  queryParams?: ApiFieldConfig[];
  bodyFields?: ApiFieldConfig[];
};

export type RequestValues = {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  bodyFields: Record<string, string>;
};

export type ExecuteRequestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  data: unknown;
};
