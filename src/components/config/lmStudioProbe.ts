export async function probeLMStudioConnection(url?: string): Promise<{ success: boolean; message: string }> {
  const targetUrl = (url || "http://localhost:1234/v1").trim();

  try {
    const res = await fetch("/api/settings/test-lm-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: targetUrl })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const countMsg = data.modelsCount !== undefined ? ` (${data.modelsCount} model${data.modelsCount === 1 ? '' : 's'} available)` : '';
      return { success: true, message: `Connected: LM Studio server responsive at ${targetUrl}${countMsg}` };
    } else {
      let probeEndpoint = targetUrl.replace(/\/$/, "");
      if (!probeEndpoint.endsWith("/models")) {
        probeEndpoint = probeEndpoint.endsWith("/v1") ? `${probeEndpoint}/models` : `${probeEndpoint}/v1/models`;
      }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const directRes = await fetch(probeEndpoint, { signal: controller.signal });
        clearTimeout(timeout);
        if (directRes.ok) {
          return { success: true, message: `Connected: Local LM Studio reachable from browser at ${targetUrl}` };
        }
      } catch (e) {}

      const errorMsg = data.error || "Connection refused or endpoint unreachable";
      return { success: false, message: errorMsg };
    }
  } catch (err: any) {
    let probeEndpoint = targetUrl.replace(/\/$/, "");
    if (!probeEndpoint.endsWith("/models")) {
      probeEndpoint = probeEndpoint.endsWith("/v1") ? `${probeEndpoint}/models` : `${probeEndpoint}/v1/models`;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const directRes = await fetch(probeEndpoint, { signal: controller.signal });
      clearTimeout(timeout);
      if (directRes.ok) {
        return { success: true, message: `Connected: Local LM Studio reachable from browser at ${targetUrl}` };
      }
    } catch (e) {}

    return { success: false, message: err.message || "Connection refused or endpoint unreachable" };
  }
}
