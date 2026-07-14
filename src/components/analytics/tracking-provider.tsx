import { MetaPageViewTracker } from "./meta-pageview-tracker";
import { MetaPixel } from "./meta-pixel";

export function TrackingProvider() {
  return <><MetaPixel /><MetaPageViewTracker /></>;
}
