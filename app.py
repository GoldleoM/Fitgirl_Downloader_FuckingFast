import os
import fitgirl_scraper
from server import app as flask_app
import gradio as gr

# Build minimal Gradio demo to comply with Hugging Face's free Gradio SDK
demo = gr.Blocks(title="FitGirl Hub FDM Vault")

with demo:
    gr.Markdown("# 🎮 FitGirl Hub FDM Vault API & Automator")
    gr.Markdown("The server is live and running! You can use the web app interface directly.")

# Mount Flask routes to Gradio app
app = gr.mount_gradio_app(flask_app, demo, path="/gradio")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    flask_app.run(host="0.0.0.0", port=port)
