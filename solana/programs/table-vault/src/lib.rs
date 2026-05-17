//! SPL token vault for “table” balance (e.g. poker): users deposit USDC/USDT;
//! tracked per-user balance; withdraw sends (amount − fee) to user and fee to treasury.
//! Fee is `amount * fee_bps / 10_000` on each withdrawal.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("842JeffU95RE7xz8Bkdu2pQQ5GDNYhmKsQxusfeG9uzL");

#[program]
pub mod table_vault {
    use super::*;

    /// Creates vault config + program-owned vault ATA for `mint`.
    /// `fee_bps`: withdrawal fee in basis points (100 = 1%, max 10_000).
    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 10_000, ErrorCode::FeeTooHigh);

        let cfg = &mut ctx.accounts.vault_config;
        cfg.authority = ctx.accounts.authority.key();
        cfg.mint = ctx.accounts.mint.key();
        cfg.fee_bps = fee_bps;
        cfg.treasury = ctx.accounts.treasury.key();
        cfg.bump = ctx.bumps.vault_config;

        Ok(())
    }

    /// Deposit SPL tokens into the vault; credits `user_balance`.
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.vault_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let ub = &mut ctx.accounts.user_balance;
        if ub.user == Pubkey::default() {
            ub.user = ctx.accounts.user.key();
            ub.mint = ctx.accounts.mint.key();
            ub.bump = ctx.bumps.user_balance;
        }
        require!(ub.user == ctx.accounts.user.key(), ErrorCode::Unauthorized);

        ub.amount = ub
            .amount
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        Ok(())
    }

    /// Withdraw `amount` from tracked balance: user receives `amount - fee`, treasury receives `fee`.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::ZeroAmount);

        let cfg = &ctx.accounts.vault_config;
        require!(cfg.mint == ctx.accounts.mint.key(), ErrorCode::BadMint);

        let ub = &mut ctx.accounts.user_balance;
        require!(ub.user == ctx.accounts.user.key(), ErrorCode::Unauthorized);
        require!(ub.amount >= amount, ErrorCode::InsufficientBalance);

        let fee = (amount as u128)
            .checked_mul(cfg.fee_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)? as u64;

        let net = amount
            .checked_sub(fee)
            .ok_or(ErrorCode::Overflow)?;

        ub.amount = ub
            .amount
            .checked_sub(amount)
            .ok_or(ErrorCode::InsufficientBalance)?;

        let mint_key = ctx.accounts.mint.key();
        let bump = cfg.bump;
        let seeds: &[&[u8]] = &[b"config", mint_key.as_ref(), &[bump]];
        let signer = &[seeds];

        if net > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token.to_account_info(),
                        to: ctx.accounts.user_token.to_account_info(),
                        authority: ctx.accounts.vault_config.to_account_info(),
                    },
                    signer,
                ),
                net,
            )?;
        }

        if fee > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token.to_account_info(),
                        to: ctx.accounts.treasury_token.to_account_info(),
                        authority: ctx.accounts.vault_config.to_account_info(),
                    },
                    signer,
                ),
                fee,
            )?;
        }

        Ok(())
    }

    /// Authority updates withdrawal fee (basis points).
    pub fn set_fee_bps(ctx: Context<UpdateAuthority>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= 10_000, ErrorCode::FeeTooHigh);
        ctx.accounts.vault_config.fee_bps = fee_bps;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: Account<'info, Mint>,
    /// CHECK: stored for withdrawal fee destination
    pub treasury: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultConfig::INIT_SPACE,
        seeds = [b"config", mint.key().as_ref()],
        bump
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = vault_config,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_config,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBalance::INIT_SPACE,
        seeds = [b"balance", user.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub user_balance: Account<'info, UserBalance>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"config", mint.key().as_ref()],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault_config,
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"balance", user.key().as_ref(), mint.key().as_ref()],
        bump = user_balance.bump,
    )]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        mut,
        constraint = treasury_token.owner == vault_config.treasury @ ErrorCode::BadTreasury,
        constraint = treasury_token.mint == mint.key() @ ErrorCode::BadMint,
    )]
    pub treasury_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority @ ErrorCode::Unauthorized)]
    pub vault_config: Account<'info, VaultConfig>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserBalance {
    pub user: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Amount must be positive")]
    ZeroAmount,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Math overflow")]
    Overflow,
    #[msg("Fee basis points cannot exceed 10000")]
    FeeTooHigh,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Treasury token account mismatch")]
    BadTreasury,
    #[msg("Mint mismatch")]
    BadMint,
}
