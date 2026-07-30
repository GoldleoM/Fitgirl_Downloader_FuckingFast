import os
import sys
from huggingface_hub import HfApi, create_repo, upload_folder

def deploy_to_hf_space(space_name, token=None):
    api = HfApi(token=token)
    try:
        user = api.whoami(token=token)['name']
    except Exception as e:
        print("[!] Error: Could not authenticate with Hugging Face.")
        print("Please provide your Hugging Face User Access Token (Write permission).")
        print("Get your token from: https://huggingface.co/settings/tokens")
        print("Run command: python create_space.py <space_name> <hf_token>")
        return

    repo_id = f"{user}/{space_name}"
    print(f"[*] Creating Hugging Face Docker Space: {repo_id}...")
    
    try:
        create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="gradio",
            private=False,
            token=token,
            exist_ok=True
        )
        print(f"[+] Space {repo_id} created or ready!")
    except Exception as e:
        print(f"Notice during space creation: {e}")

    print("[*] Uploading project files to Hugging Face Space...")
    ignore_patterns = [".git/*", "__pycache__/*", "*.pyc", "download_links.txt", ".venv/*", "node_modules/*"]
    
    upload_folder(
        folder_path=".",
        repo_id=repo_id,
        repo_type="space",
        token=token,
        ignore_patterns=ignore_patterns
    )
    print(f"\n[+] SUCCESS! Your Space is building and will run live at:")
    print(f"Hugging Face Space: https://huggingface.co/spaces/{repo_id}")
    print(f"Direct Web App URL: https://{user}-{space_name.replace('_', '-')}.hf.space")

if __name__ == '__main__':
    token = os.environ.get('HF_TOKEN')
    space_name = sys.argv[1] if len(sys.argv) > 1 else "fitgirl-hub-fdm-vault"
    if len(sys.argv) > 2:
        token = sys.argv[2]
        
    deploy_to_hf_space(space_name, token)
