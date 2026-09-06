import { makeCrudHooks, makeWorkflowHooks } from "../admin-shared/hooks";
import type {
  CareersRow,
  NewsRow,
  ProjectRow,
  ResourceRow,
  ServiceRow,
} from "./types";

export const services = makeWorkflowHooks<ServiceRow, Record<string, unknown>>(
  "cat-services",
  "/admin/services/",
);
export const portfolio = makeWorkflowHooks<ProjectRow, Record<string, unknown>>(
  "cat-portfolio",
  "/admin/portfolio/",
);
export const news = makeWorkflowHooks<NewsRow, Record<string, unknown>>(
  "cat-news",
  "/admin/news/",
);

export const resources = makeCrudHooks<ResourceRow, Record<string, unknown>>(
  "cat-resources",
  "/admin/resources/",
);
export const careers = makeCrudHooks<CareersRow, Record<string, unknown>>(
  "cat-careers",
  "/admin/careers/",
);
