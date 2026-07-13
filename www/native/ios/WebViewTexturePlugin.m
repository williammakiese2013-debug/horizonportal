#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WebViewTexturePlugin, "WebViewTexture",
    CAP_PLUGIN_METHOD(load, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(tap, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(scrollBy, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setFPS, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(destroy, CAPPluginReturnPromise);
)
