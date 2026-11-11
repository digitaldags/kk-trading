import { cache } from "react";
import { publishService } from "@/lib/services";

/** Whether the draft has unpublished changes. The layout and a page share one query. */
export const getPublishStatus = cache(() => publishService.status());
